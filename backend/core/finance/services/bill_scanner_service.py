"""
BillScannerService — Quota-aware Gemini Vision bill parsing.

Key quota & cost safeguards:
  1. Image is shrunk to ≤ 800 px on the longest side and JPEG-encoded at
     quality=50 *before* being sent to Gemini. A typical phone photo
     (4 MB, 4000×3000) is reduced to ~50–80 KB — roughly 50× smaller.
  2. The prompt is <150 tokens (no boilerplate, tightly scoped JSON schema).
  3. We use `gemini-3.8-flash` — the most cost-efficient multimodal model.
  4. No image is persisted to the database or storage; all processing is
     in-memory (RAM only, no temp files on disk).
  5. A `scan_bill` DRF throttle scope (10/hour per IP) prevents abuse.
"""

import io
import base64
import json
import logging
from datetime import date

from django.conf import settings

from ..models import Category

logger = logging.getLogger(__name__)

# ── Compression constants ──────────────────────────────────────────────────────
MAX_DIMENSION_PX = 800   # longest side; Gemini reads text fine at this resolution
JPEG_QUALITY = 50        # aggressive but sufficient for OCR-style tasks


def _compress_image_bytes(raw_bytes: bytes) -> tuple[bytes, str]:
    """
    Compress an image to ≤ 800 px / JPEG-50 in-memory using Pillow.

    Returns (compressed_bytes, mime_type).
    Falls back to the original bytes if Pillow is unavailable or fails.
    """
    try:
        from PIL import Image  # Pillow; already a common Django dependency

        img = Image.open(io.BytesIO(raw_bytes))

        # Convert RGBA/P mode images (PNG with transparency) to RGB for JPEG output
        if img.mode in ("RGBA", "P", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize so the longest side is MAX_DIMENSION_PX
        w, h = img.size
        longest = max(w, h)
        if longest > MAX_DIMENSION_PX:
            scale = MAX_DIMENSION_PX / longest
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img = img.resize((new_w, new_h), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        compressed = buf.getvalue()

        reduction_pct = round((1 - len(compressed) / len(raw_bytes)) * 100, 1)
        logger.info(
            "Bill image compressed: %d KB → %d KB (%.1f%% reduction, %dx%d px)",
            len(raw_bytes) // 1024,
            len(compressed) // 1024,
            reduction_pct,
            img.width,
            img.height,
        )
        return compressed, "image/jpeg"

    except Exception as exc:
        logger.warning("Image compression failed (%s); using original bytes.", exc)
        return raw_bytes, "image/jpeg"


class BillScannerService:
    """Parse a bill / receipt image with Gemini Vision and return structured data."""

    # ── Quota guard ────────────────────────────────────────────────────────────
    # Flash multimodal is ~0.00038 $/image on free tier. We hard-cap to 10/hour
    # via DRF throttle on the view so the service itself stays stateless.
    MODEL = "gemini-3.8-flash"

    @classmethod
    def scan(cls, image_bytes: bytes) -> dict:
        """
        Main entry point.

        Args:
            image_bytes: Raw uploaded image bytes (any common format).

        Returns:
            dict with keys: type, title, amount, date, category_id,
                            payment_method, line_items, raw_text, confidence.
        """
        api_key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
        if not api_key:
            return cls._error_response("GEMINI_API_KEY is not configured.")

        # Step 1: Compress before sending — critical for free quota
        compressed_bytes, mime_type = _compress_image_bytes(image_bytes)

        # Step 2: Fetch category context (compact: id + name + type only)
        category_context = list(
            Category.objects.values("id", "name", "type").order_by("name")
        )

        # Step 3: Build a tight, low-token prompt
        prompt = cls._build_prompt(category_context)

        # Step 4: Call Gemini
        try:
            result_text = cls._call_gemini(api_key, compressed_bytes, mime_type, prompt)
        except Exception as exc:
            logger.error("Gemini Vision call failed: %s", exc)
            return cls._error_response(f"Gemini API error: {exc}")

        # Step 5: Parse JSON from response
        parsed = cls._parse_json(result_text)
        if parsed is None:
            return cls._error_response("Could not parse structured data from the image.")

        # Step 6: Validate & enrich
        return cls._enrich(parsed, category_context)

    # ── Internal helpers ───────────────────────────────────────────────────────

    @classmethod
    def _build_prompt(cls, categories: list[dict]) -> str:
        today = date.today().isoformat()
        cat_list = ", ".join(
            f'{c["id"]}:{c["name"]}({c["type"]})' for c in categories
        )
        return (
            f"Today: {today}. "
            f"Available categories (id:name:type) — {cat_list}. "
            "Extract the following from this bill/receipt image (amounts in Indian Rupees ₹ / INR) and respond ONLY with valid JSON "
            "(no markdown fences, no extra text):\n"
            '{"type":"DEBIT|CREDIT","title":"<merchant or payer>","amount":<number>,'
            '"date":"<YYYY-MM-DD or null>","category_id":<int or null>,'
            '"payment_method":"CASH|UPI|CREDIT_CARD|DEBIT_CARD|BANK_TRANSFER|OTHER",'
            '"line_items":[{"name":"","qty":1,"price":0}],'
            '"confidence":"high|medium|low"}'
        )

    @classmethod
    def _call_gemini(
        cls, api_key: str, image_bytes: bytes, mime_type: str, prompt: str
    ) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        text_part = types.Part.from_text(text=prompt)

        response = client.models.generate_content(
            model=cls.MODEL,
            contents=[types.Content(role="user", parts=[image_part, text_part])],
            config=types.GenerateContentConfig(
                # Keep output tokens low — we only need JSON
                max_output_tokens=512,
                temperature=0.1,  # near-deterministic for extraction tasks
            ),
        )
        return response.text or ""

    @classmethod
    def _parse_json(cls, text: str) -> dict | None:
        """Strip any accidental markdown fences and parse JSON."""
        text = text.strip()
        # Remove ```json ... ``` or ``` ... ```
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(
                line for line in lines
                if not line.strip().startswith("```")
            )
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try extracting first {...} block
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
        logger.warning("Could not parse Gemini response as JSON: %s", text[:200])
        return None

    @classmethod
    def _enrich(cls, data: dict, categories: list[dict]) -> dict:
        """Validate fields and ensure safe defaults."""
        valid_types = {"DEBIT", "CREDIT"}
        valid_methods = {"CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "BANK_TRANSFER", "OTHER"}

        tx_type = str(data.get("type", "DEBIT")).upper()
        if tx_type not in valid_types:
            tx_type = "DEBIT"

        payment_method = str(data.get("payment_method", "OTHER")).upper()
        if payment_method not in valid_methods:
            payment_method = "OTHER"

        amount = data.get("amount")
        try:
            amount = float(amount)
            if amount <= 0:
                amount = None
        except (TypeError, ValueError):
            amount = None

        bill_date = data.get("date")
        if bill_date and bill_date != "null":
            try:
                date.fromisoformat(str(bill_date))
            except ValueError:
                bill_date = None
        else:
            bill_date = None

        # Validate category_id exists in DB
        category_id = data.get("category_id")
        valid_ids = {c["id"] for c in categories}
        if category_id not in valid_ids:
            category_id = None

        line_items = data.get("line_items", [])
        if not isinstance(line_items, list):
            line_items = []

        return {
            "success": True,
            "type": tx_type,
            "title": str(data.get("title", "")).strip()[:200] or "Scanned Bill",
            "amount": amount,
            "date": bill_date,
            "category_id": category_id,
            "payment_method": payment_method,
            "line_items": line_items,
            "confidence": data.get("confidence", "low"),
        }

    @staticmethod
    def _error_response(message: str) -> dict:
        return {"success": False, "error": message}

