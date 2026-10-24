import hashlib
import json
import logging
from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.utils import timezone

from ..models import AIReportCache, Transaction, PeerDebt, SavingsGoal
from .analytics_service import AnalyticsService
from .ai_gateway import AIGateway

logger = logging.getLogger(__name__)


class GeminiService:
    CACHE_DURATION_HOURS = 6

    @classmethod
    def generate_report(cls, force_refresh=False):
        """
        Generates or retrieves a cached AI Financial Report.
        Protects the free Gemini API quota via:
        1. Pre-aggregated statistical digest (< 300 tokens prompt).
        2. Content-hash based caching in SQLite3.
        3. Time-to-live cache check (6 hours).
        4. Graceful offline fallback on 429 / missing key.
        """
        # Step 1: Collect financial summary metrics
        summary = AnalyticsService.get_summary()
        categories = AnalyticsService.get_category_breakdown()
        who_owes = AnalyticsService.get_who_owes_summary()

        now = timezone.now()
        period_start = (now - timedelta(days=30)).date()
        period_end = now.date()

        # Step 2: Build compact digest
        digest = {
            "period": f"{period_start} to {period_end}",
            "income": summary["total_income"],
            "expense": summary["total_expense"],
            "net_balance": summary["net_balance"],
            "savings_current": summary["total_saved"],
            "savings_target": summary["total_target_savings"],
            "money_given_by_me": summary["total_amount_given"],
            "remainder_to_receive": summary["remainder_to_receive"],
            "money_borrowed_by_me": summary["total_amount_borrowed"],
            "remainder_to_pay": summary["remainder_to_pay"],
            "top_expense_categories": [
                {"name": c["category_name"], "amount": c["amount"], "pct": c["percentage"]}
                for c in categories["expenses"]["breakdown"][:5]
            ],
            "overdue_receivables": [
                {"name": w["person_name"], "due": w["remainder_due"]}
                for w in who_owes["who_owes_list"]
                if w["is_overdue"]
            ][:3],
        }

        # Step 3: Compute data hash
        digest_bytes = json.dumps(digest, sort_keys=True).encode("utf-8")
        data_hash = hashlib.sha256(digest_bytes).hexdigest()

        # Step 4: Check cache
        if not force_refresh:
            cached_report = (
                AIReportCache.objects.filter(
                    data_hash=data_hash,
                    generated_at__gte=now - timedelta(hours=cls.CACHE_DURATION_HOURS),
                )
                .order_by("-generated_at")
                .first()
            )
            if cached_report:
                return {
                    "source": "cache",
                    "generated_at": cached_report.generated_at,
                    "content_json": cached_report.content_json,
                    "content_markdown": cached_report.content_markdown,
                }

        # Step 5: Generate report via Gemini API or Fallback
        api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
        report_data = None
        source = "gemini_free_tier"

        if api_key.strip():
            try:
                report_data = cls._call_gemini_api(api_key, digest)
            except Exception as e:
                logger.warning("Gemini API call failed or quota exceeded: %s. Using heuristic fallback.", e)
                report_data = cls._generate_heuristic_report(digest)
                source = "heuristic_fallback (quota/api limit safeguard)"
        else:
            report_data = cls._generate_heuristic_report(digest)
            source = "heuristic_fallback (no API key configured)"

        # Step 6: Store in Cache
        cache_entry = AIReportCache.objects.create(
            report_type="financial_health",
            period_start=period_start,
            period_end=period_end,
            data_hash=data_hash,
            content_json=report_data.get("json", {}),
            content_markdown=report_data.get("markdown", ""),
        )

        return {
            "source": source,
            "generated_at": cache_entry.generated_at,
            "content_json": cache_entry.content_json,
            "content_markdown": cache_entry.content_markdown,
        }

    @classmethod
    def _call_gemini_api(cls, api_key, digest):
        """Calls Google Gemini API via AIGateway with quota limiting and auto-retries."""
        prompt = f"""
You are an expert personal financial advisor and auditor. All amounts are in Indian Rupees (₹ / INR). Analyze this user's 30-day financial snapshot:
```json
{json.dumps(digest, indent=2)}
```

Provide a high-quality financial assessment in Indian Rupees (₹). Respond in two parts:
1. A concise Markdown report using ₹ symbol for all amounts with:
   - ### Financial Health Overview
   - ### Spending & Savings Evaluation
   - ### Peer Dues & Receivables Action Plan
   - ### 3 Key Actionable Recommendations for Next Month
2. At the very end, include a JSON block enclosed within ```json:report ... ``` with this exact structure:
{{
  "health_score": <number between 1 and 100>,
  "status": "<Needs Improvement | Fair | Good | Excellent>",
  "top_risk": "<short risk summary>",
  "top_opportunity": "<short opportunity summary>",
  "savings_rate_pct": <number>
}}
"""

        text = AIGateway.generate_content(
            prompt=prompt,
            max_output_tokens=1000,
            temperature=0.2,
            max_retries=3,
        )

        # Extract JSON block if present
        parsed_json = {}
        markdown_text = text

        if "```json:report" in text:
            parts = text.split("```json:report")
            markdown_text = parts[0].strip()
            json_block = parts[1].split("```")[0].strip()
            try:
                parsed_json = json.loads(json_block)
            except Exception:
                pass
        elif "```json" in text:
            # Check for regular json block at end
            parts = text.split("```json")
            if len(parts) > 1:
                potential_json = parts[-1].split("```")[0].strip()
                try:
                    parsed_json = json.loads(potential_json)
                    markdown_text = parts[0].strip()
                except Exception:
                    pass

        if not parsed_json:
            parsed_json = cls._calculate_score_json(digest)

        return {"markdown": markdown_text, "json": parsed_json}

    @classmethod
    def _generate_heuristic_report(cls, digest):
        """Rule-based financial health assessment used when Gemini quota is reached or key is absent."""
        income = digest["income"]
        expense = digest["expense"]
        net_balance = digest["net_balance"]
        savings = digest["savings_current"]
        remainder_to_receive = digest["remainder_to_receive"]
        remainder_to_pay = digest["remainder_to_pay"]

        savings_rate = round((net_balance / income) * 100, 1) if income > 0 else 0.0

        # Calculate score
        score = 60
        if savings_rate >= 20:
            score += 20
        elif savings_rate > 0:
            score += 10
        else:
            score -= 20

        if remainder_to_pay > income * 0.5:
            score -= 15

        if remainder_to_receive > 0:
            score += 5

        score = max(10, min(95, score))

        if score >= 80:
            status = "Excellent"
        elif score >= 65:
            status = "Good"
        elif score >= 50:
            status = "Fair"
        else:
            status = "Needs Improvement"

        top_cats = digest.get("top_expense_categories", [])
        top_cat_name = top_cats[0]["name"] if top_cats else "None"
        top_cat_pct = top_cats[0]["pct"] if top_cats else 0

        markdown = f"""### Financial Health Overview
Your financial score for the last 30 days is **{score}/100 ({status})**.
- **Total Income**: ₹{income:,.2f}
- **Total Expenses**: ₹{expense:,.2f}
- **Net Cashflow**: ₹{net_balance:,.2f}
- **Savings Rate**: {savings_rate}%

### Spending & Savings Evaluation
- Your highest spending category was **{top_cat_name}**, accounting for **{top_cat_pct}%** of your total monthly outflow.
- Total accumulated savings across goals currently stand at **₹{savings:,.2f}**.
- {"Great job maintaining a positive savings buffer!" if net_balance > 0 else "Warning: Your monthly outflow exceeded your inflow. Focus on trimming discretionary categories."}

### Peer Dues & Receivables Action Plan
- **Money Given to Others**: You have **₹{remainder_to_receive:,.2f}** pending to be collected from peers.
- **Money Borrowed from Others**: You owe **₹{remainder_to_pay:,.2f}** to peers that needs repayment.
- **Net Peer Remainder**: **₹{(remainder_to_receive - remainder_to_pay):,.2f}**.
{"- You have overdue pending collections. Send polite payment reminders via the Reminders tab." if digest.get("overdue_receivables") else "- No urgent overdue peer dues detected."}

### 3 Key Actionable Recommendations for Next Month
1. **Target {top_cat_name}**: Look for 10-15% reduction in your largest spending category.
2. **Collect Outstanding Remainders**: Prioritize collecting the ₹{remainder_to_receive:,.2f} owed to you before lending further.
3. **Automate Savings**: Move your positive cashflow (₹{max(0, net_balance):,.2f}) into your active savings targets at the start of the month.
"""

        parsed_json = {
            "health_score": score,
            "status": status,
            "top_risk": f"High concentration in {top_cat_name}" if top_cat_pct > 35 else "Low cashflow margin",
            "top_opportunity": "Recover pending receivables from peers" if remainder_to_receive > 100 else "Increase monthly savings allocation",
            "savings_rate_pct": savings_rate,
        }

        return {"markdown": markdown.strip(), "json": parsed_json}

    @classmethod
    def _calculate_score_json(cls, digest):
        income = digest["income"]
        net_balance = digest["net_balance"]
        savings_rate = round((net_balance / income) * 100, 1) if income > 0 else 0.0
        score = 70 if savings_rate >= 15 else 55
        return {
            "health_score": score,
            "status": "Good" if score >= 70 else "Fair",
            "top_risk": "Expense pacing",
            "top_opportunity": "Grow emergency savings",
            "savings_rate_pct": savings_rate,
        }
