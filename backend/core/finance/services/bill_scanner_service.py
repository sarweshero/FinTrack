"""
BillScannerService — Fast, Quota-aware Gemini Vision bill parsing & background processing.

Key quota & cost safeguards:
  1. Image is compressed client-side (Canvas 800px) and optionally on backend.
  2. The prompt is tightly scoped to minimize token usage.
  3. Uses `gemini-3.5-flash-lite` (fastest & lowest-cost multimodal model)
     with fallbacks to `gemini-flash-lite-latest` and `gemini-3.8-flash`.
  4. Direct HTTPS REST requests via standard library `urllib.request` avoid
     pydantic / C-extension issues and ensure ultra-low latency.
  5. Async background worker auto-creates Transaction in DB to update balance
     and ledger without blocking the client upload.
"""

import io
import base64
import json
import logging
import urllib.request
import urllib.error
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from ..models import Category, Transaction, BillScanTask

logger = logging.getLogger(__name__)

MAX_DIMENSION_PX = 800
JPEG_QUALITY = 50


def _compress_image_bytes(raw_bytes: bytes) -> tuple[bytes, str]:
    """
    Compress an image to ≤ 800 px / JPEG-50 in-memory using Pillow if available.
    Returns (compressed_bytes, mime_type).
    Falls back gracefully to original bytes if Pillow C-extension is unavailable.
    """
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(raw_bytes))
        if img.mode in ("RGBA", "P", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        w, h = img.size
        longest = max(w, h)
        if longest > MAX_DIMENSION_PX:
            scale = MAX_DIMENSION_PX / longest
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img = img.resize((new_w, new_h), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        return buf.getvalue(), "image/jpeg"
    except Exception as exc:
        logger.debug("Server-side Pillow compression skipped (%s); using original bytes.", exc)
        # Determine mime type from magic bytes if possible
        if raw_bytes.startswith(b"\x89PNG"):
            return raw_bytes, "image/png"
        return raw_bytes, "image/jpeg"


class BillScannerService:
    """Parse a bill / receipt image with Gemini Vision and return structured data."""

    # Models ordered by speed & cost efficiency
    MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash"]

    @classmethod
    def scan(cls, image_bytes: bytes) -> dict:
        api_key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
        if not api_key:
            return cls._error_response("GEMINI_API_KEY is not configured.")

        # Step 1: In-memory compression
        compressed_bytes, mime_type = _compress_image_bytes(image_bytes)

        # Step 2: Fetch category context for accurate classification
        category_context = list(
            Category.objects.values("id", "name", "type").order_by("name")
        )

        # Step 3: Low-token prompt
        prompt = cls._build_prompt(category_context)

        # Step 4: Call Gemini Vision with model fallbacks
        result_text = None
        last_error = None

        for model_name in cls.MODELS:
            try:
                result_text = cls._call_gemini_rest(model_name, api_key, compressed_bytes, mime_type, prompt)
                if result_text:
                    logger.info("Successfully scanned bill using model: %s", model_name)
                    break
            except Exception as exc:
                last_error = exc
                logger.warning("Gemini model %s failed: %s; trying next model...", model_name, exc)

        if not result_text:
            return cls._error_response(f"Gemini API error: {last_error or 'All vision models failed'}")

        # Step 5: Parse JSON
        parsed = cls._parse_json(result_text)
        if parsed is None:
            return cls._error_response("Could not parse structured data from the image.")

        # Step 6: Validate & enrich
        return cls._enrich(parsed, category_context)

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
    def _call_gemini_rest(
        cls, model_name: str, api_key: str, image_bytes: bytes, mime_type: str, prompt: str
    ) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

        b64_img = base64.b64encode(image_bytes).decode("utf-8")
        req_body = {
            "contents": [{
                "role": "user",
                "parts": [
                    {"inline_data": {"mime_type": mime_type, "data": b64_img}},
                    {"text": prompt}
                ]
            }],
            "generationConfig": {
                "maxOutputTokens": 600,
                "temperature": 0.1
            }
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(req_body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "")
        return ""

    @classmethod
    def _parse_json(cls, text: str) -> dict | None:
        text = text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(
                line for line in lines
                if not line.strip().startswith("```")
            )
        try:
            return json.loads(text)
        except json.JSONDecodeError:
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


def process_bill_task_in_background(task_id: str, raw_bytes: bytes):
    """
    Background worker thread function.
    Processes the bill image with Gemini, auto-creates the Transaction in DB to
    update user balance & ledger immediately, and marks the task COMPLETED.
    """
    try:
        task = BillScanTask.objects.filter(id=task_id).first()
        if not task:
            logger.error("BillScanTask %s not found in worker thread.", task_id)
            return

        result = BillScannerService.scan(raw_bytes)

        if not result.get("success"):
            task.status = BillScanTask.Status.FAILED
            task.error_message = result.get("error", "Failed to parse bill image.")
            task.save(update_fields=["status", "error_message", "updated_at"])
            return

        task.extracted_data = result

        # Auto-create the transaction in the database so user balance is updated immediately
        amount = result.get("amount")
        if amount and float(amount) > 0:
            tx_type = result.get("type", "DEBIT")
            title = result.get("title", "Scanned Bill")
            tx_date = result.get("date") or timezone.localdate().isoformat()
            category_id = result.get("category_id")
            category = Category.objects.filter(id=category_id).first() if category_id else None
            payment_method = result.get("payment_method", "OTHER")

            # Formulate friendly description
            line_items = result.get("line_items", [])
            desc_parts = ["Auto-scanned bill."]
            if line_items:
                item_names = [item.get("name") for item in line_items if item.get("name")]
                if item_names:
                    desc_parts.append(f"Items: {', '.join(item_names[:4])}")

            tx = Transaction.objects.create(
                type=tx_type,
                title=title,
                amount=Decimal(str(round(amount, 2))),
                date=tx_date,
                category=category,
                payment_method=payment_method,
                description=" | ".join(desc_parts),
            )
            task.transaction = tx

        task.status = BillScanTask.Status.COMPLETED
        task.save(update_fields=["status", "extracted_data", "transaction", "updated_at"])
        logger.info("BillScanTask %s completed successfully. Transaction ID: %s", task_id, getattr(task.transaction, "id", None))

    except Exception as exc:
        logger.exception("Unexpected error processing BillScanTask %s: %s", task_id, exc)
        try:
            task = BillScanTask.objects.filter(id=task_id).first()
            if task:
                task.status = BillScanTask.Status.FAILED
                task.error_message = f"Background processing error: {exc}"
                task.save(update_fields=["status", "error_message", "updated_at"])
        except Exception:
            pass
