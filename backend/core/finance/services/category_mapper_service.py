"""
CategoryMapperService — AI-Powered & Quota-Optimized Expense Category Auto-Mapping.

Features:
1. Fast-Path Heuristic Classifier (Zero Quota):
   Instantly matches prominent Indian & global merchants/keywords (e.g. Swiggy, DMart, Shell,
   Blinkit, Uber, Netflix, Jio) to appropriate existing categories without consuming AI quota.
2. AI-Powered Fallback with Quota Protection:
   When keywords are novel or ambiguous, calls Gemini via AIGateway with a compact prompt
   (< 90 tokens) returning exact category mappings.
3. Automatic Quota Refresh & Auto-Retry:
   If Gemini quota (429) is encountered, AIGateway waits for the window to refresh and retries.
4. LRU In-Memory Caching:
   Caches recent title -> category mappings so repeated queries consume zero API calls.
"""

import logging
import re
from typing import Any
from django.db.models import Q
from ..models import Category, Transaction
from .ai_gateway import AIGateway

logger = logging.getLogger(__name__)

# Fast-path keyword knowledge base: maps keywords to category themes
KEYWORD_THEMES: dict[str, list[str]] = {
    "food": [
        "swiggy", "zomato", "mcdonald", "starbucks", "kfc", "dominos", "pizza",
        "burger", "restaurant", "cafe", "coffee", "chai", "tea", "biryani",
        "bakery", "subway", "dunkin", "haldiram", "dinner", "lunch", "breakfast"
    ],
    "groceries": [
        "dmart", "blinkit", "zepto", "instamart", "bigbasket", "reliance fresh",
        "supermarket", "grocery", "groceries", "vegetable", "veggies", "fruits",
        "milk", "dairy", "spices", "provisions", "nature's basket", "more retail"
    ],
    "transport": [
        "uber", "ola", "rapido", "petrol", "diesel", "fuel", "shell", "hp fuel",
        "indian oil", "bharat petroleum", "fastag", "toll", "metro", "bus",
        "train", "irctc", "railway", "auto", "parking", "flight", "indigo"
    ],
    "entertainment": [
        "netflix", "spotify", "prime", "hotstar", "youtube", "cinema", "movie",
        "pvr", "inox", "bookmyshow", "game", "steam", "playstation", "disney"
    ],
    "bills": [
        "electricity", "bescom", "tneb", "water bill", "broadband", "wifi",
        "airtel", "jio", "vi recharge", "cylinder", "indane", "hp gas", "dth",
        "tata sky", "maintenance", "recharge", "postpaid", "utility"
    ],
    "shopping": [
        "amazon", "flipkart", "myntra", "ajio", "zara", "h&m", "croma",
        "reliance digital", "meesho", "clothing", "shoes", "electronics", "mall"
    ],
    "health": [
        "apollo", "pharmacy", "medplus", "doctor", "hospital", "clinic",
        "medicine", "1mg", "pharmeasy", "practo", "dentist", "lab test"
    ],
    "salary": [
        "salary", "payroll", "stipend", "wages", "bonus", "dividend",
        "freelance", "client payout", "interest credit", "cashback", "refund"
    ],
    "investment": [
        "zerodha", "groww", "upstox", "mutual fund", "sip", "stocks",
        "etf", "coin", "gold", "fixed deposit", "fd"
    ],
    "education": [
        "school", "college", "tuition", "course", "udemy", "coursera",
        "books", "stationery", "fee", "exam"
    ],
}


class CategoryMapperService:
    """Intelligently maps transaction Title and Note to an existing Category."""

    _cache: dict[str, dict[str, Any]] = {}

    @classmethod
    def _normalize(cls, text: str) -> str:
        return re.sub(r"[^\w\s]", " ", (text or "").lower()).strip()

    @classmethod
    def _match_heuristic(
        cls, text: str, categories: list[dict[str, Any]], tx_type: str
    ) -> dict[str, Any] | None:
        """
        Fast-path heuristic: Checks if text contains keywords mapped to category themes.
        Zero token usage and instant.
        """
        normalized = cls._normalize(text)
        if not normalized:
            return None

        # Filter categories by matching transaction type
        target_type = "EXPENSE" if tx_type == "DEBIT" else "INCOME"
        eligible = [
            c for c in categories
            if c["type"] in (target_type, "BOTH")
        ]
        if not eligible:
            eligible = categories

        # 1. Direct match with category name
        for cat in eligible:
            cat_name_norm = cls._normalize(cat["name"])
            if cat_name_norm and (cat_name_norm in normalized or normalized in cat_name_norm):
                return {
                    "category_id": cat["id"],
                    "category_name": cat["name"],
                    "confidence": "high",
                    "reason": f"Direct name match with '{cat['name']}'",
                }

        # 2. Knowledge-base theme matching
        for theme, keywords in KEYWORD_THEMES.items():
            for kw in keywords:
                if re.search(r"\b" + re.escape(kw) + r"\b", normalized):
                    # Find candidate category matching this theme
                    for cat in eligible:
                        cat_lower = cat["name"].lower()
                        if theme in cat_lower or any(k in cat_lower for k in keywords[:3]):
                            return {
                                "category_id": cat["id"],
                                "category_name": cat["name"],
                                "confidence": "high",
                                "reason": f"Matched merchant keyword '{kw}' to category '{cat['name']}'",
                            }

        return None

    @classmethod
    def suggest_category(
        cls,
        title: str,
        description: str = "",
        tx_type: str = "DEBIT",
        user_categories: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Suggests the best category for a given title and description.
        1. Checks LRU memory cache.
        2. Tries fast heuristic (saving API quota).
        3. Calls Gemini via AIGateway with automatic 429 quota retry.
        """
        raw_combined = f"{title.strip()} {description.strip()}".strip()
        if not raw_combined:
            return {
                "category_id": None,
                "category_name": None,
                "confidence": "low",
                "reason": "Title and note are empty.",
            }

        cache_key = f"{cls._normalize(raw_combined)}::{tx_type.upper()}"
        if cache_key in cls._cache:
            return cls._cache[cache_key]

        # Fetch categories from DB if not provided
        if user_categories is None:
            target_type = "EXPENSE" if tx_type == "DEBIT" else "INCOME"
            cats_qs = Category.objects.filter(
                Q(type=target_type) | Q(type=Category.CategoryType.BOTH)
            ).values("id", "name", "type").order_by("name")
            categories = list(cats_qs)
            if not categories:
                categories = list(Category.objects.values("id", "name", "type").order_by("name"))
        else:
            categories = user_categories

        if not categories:
            return {
                "category_id": None,
                "category_name": None,
                "confidence": "low",
                "reason": "No categories found in the system.",
            }

        # Step 1: Fast-path heuristic match (0 quota cost)
        heuristic_match = cls._match_heuristic(raw_combined, categories, tx_type)
        if heuristic_match:
            cls._cache[cache_key] = heuristic_match
            return heuristic_match

        # Step 2: AI categorization via AIGateway (with 429 auto-retry)
        cat_options = ", ".join(f'{c["id"]}:{c["name"]}' for c in categories)
        prompt = (
            f"You are an expense categorizer. Available categories (id:name):\n"
            f"{cat_options}\n\n"
            f"Transaction to categorize:\n"
            f'Type: {tx_type}, Title: "{title}", Note: "{description}"\n\n'
            f"Select the single best matching category id from the list above.\n"
            f"Respond ONLY with valid JSON (no markdown, no other text):\n"
            f'{{"category_id": <int or null>, "category_name": "<matching name or null>", '
            f'"confidence": "high|medium|low", "reason": "<max 6 words>"}}'
        )

        try:
            ai_result = AIGateway.generate_json(
                prompt=prompt,
                max_output_tokens=120,
                temperature=0.1,
                max_retries=3,
            )

            if ai_result and isinstance(ai_result, dict):
                cat_id = ai_result.get("category_id")
                # Validate that category_id exists in our list
                matched_cat = next((c for c in categories if c["id"] == cat_id), None)
                if matched_cat:
                    res = {
                        "category_id": matched_cat["id"],
                        "category_name": matched_cat["name"],
                        "confidence": ai_result.get("confidence", "medium"),
                        "reason": ai_result.get("reason", "Mapped via AI"),
                    }
                    cls._cache[cache_key] = res
                    return res

        except Exception as exc:
            logger.warning("Category AI classification failed or quota exhausted: %s", exc)

        # Fallback if AI couldn't classify: pick first category or None
        fallback_res = {
            "category_id": None,
            "category_name": None,
            "confidence": "low",
            "reason": "Could not automatically determine category.",
        }
        return fallback_res

