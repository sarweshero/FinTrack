"""
AIGateway — Centralized, Quota-Aware Google Gemini Gateway with Automatic Retries.

Safeguards:
1. Preemptive Rate Limiting (Under Gemini Free Quota):
   - Gemini free tier permits max 15 Requests Per Minute (RPM).
   - Tracks a sliding window of request timestamps and proactively delays
     requests if approaching 14 RPM to prevent 429 errors.
2. Quota Refresh Waiting & Auto-Retry:
   - Catches HTTP 429 (ResourceExhausted / Rate Limit / Quota Exceeded).
   - Parses Retry-After header or quota reset error messages.
   - If not specified, sleeps for the rolling quota refresh window (20s, 40s, 60s)
     with jitter to allow the quota bucket to replenish.
   - Automatically retries up to `max_retries` attempts without failing the task.
3. Multi-Model Fallback Chain:
   - Models ordered by speed and lowest token footprint:
     gemini-3.5-flash-lite -> gemini-flash-lite-latest -> gemini-3.8-flash.
   - Automatically switches models if a model is deprecated or unreachable.
4. Universal Utility for all AI-dependent tasks:
   - Bill Scanner OCR (multimodal)
   - Category Auto-Mapping from Title/Note (text)
   - AI Financial Health Report generation (text)
"""

import base64
import json
import logging
import random
import re
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


class GeminiQuotaExceededError(Exception):
    """Raised when Gemini quota is exhausted and all auto-retries failed."""
    pass


class AIGateway:
    """Central gateway for all Gemini API interactions with rate limiting and auto-retries."""

    # Supported current models (fastest & lowest token footprint first)
    DEFAULT_MODELS = [
        "gemini-3.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.8-flash",
    ]

    # Preemptive rate limiting: free tier max 15 RPM. Target 13 for safety.
    MAX_REQUESTS_PER_MINUTE = 13
    _request_timestamps: deque = deque()
    _rate_lock: threading.Lock = threading.Lock()

    @classmethod
    def _enforce_rate_limit(cls):
        """Preemptively delay execution if we are approaching the free tier 15 RPM limit."""
        with cls._rate_lock:
            now = time.time()
            cutoff = now - 60.0

            # Prune timestamps older than 60 seconds
            while cls._request_timestamps and cls._request_timestamps[0] < cutoff:
                cls._request_timestamps.popleft()

            if len(cls._request_timestamps) >= cls.MAX_REQUESTS_PER_MINUTE:
                oldest = cls._request_timestamps[0]
                wait_needed = max(0.5, (oldest + 61.0) - now)
                logger.info(
                    "AIGateway: Approaching free-tier quota (%d requests in last 60s). "
                    "Waiting %.2f seconds to maintain quota safety...",
                    len(cls._request_timestamps),
                    wait_needed,
                )
                time.sleep(wait_needed)
                now = time.time()

            cls._request_timestamps.append(now)

    @classmethod
    def _parse_retry_delay(cls, http_err: urllib.error.HTTPError, attempt: int) -> float:
        """
        Extract wait time from HTTP headers or response body for 429 errors.
        Falls back to rolling-window backoff (20s, 40s, 60s + jitter).
        """
        # 1. Check Retry-After header
        retry_header = http_err.headers.get("Retry-After") if hasattr(http_err, "headers") else None
        if retry_header:
            try:
                seconds = float(retry_header)
                if seconds > 0:
                    return min(65.0, seconds + random.uniform(0.5, 1.5))
            except (ValueError, TypeError):
                pass

        # 2. Check error body for delay hints
        try:
            err_body = http_err.read().decode("utf-8", errors="replace")
            # Look for e.g. "reset in 18s", "retry after 25s", "quota reset in 20.4s"
            match = re.search(r"(?:retry\s+after|reset\s+in|quota\s+reset\s+in)\s*(\d+(?:\.\d+)?)\s*s", err_body, re.I)
            if match:
                seconds = float(match.group(1))
                return min(65.0, seconds + random.uniform(0.5, 2.0))
        except Exception:
            pass

        # 3. Default to quota refresh window backoff
        # Gemini free tier per-minute quotas reset every 60 seconds.
        backoff_steps = [20.0, 40.0, 60.0]
        base = backoff_steps[min(attempt, len(backoff_steps) - 1)]
        jitter = random.uniform(1.0, 3.5)
        return base + jitter

    @classmethod
    def generate_content(
        cls,
        prompt: str,
        image_bytes: bytes | None = None,
        mime_type: str = "image/jpeg",
        max_output_tokens: int = 600,
        temperature: float = 0.1,
        model_candidates: list[str] | None = None,
        max_retries: int = 3,
    ) -> str:
        """
        Executes a Gemini generateContent request with rate limiting and quota-aware auto-retry.
        """
        api_key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured in settings or environment.")

        models_to_try = model_candidates or cls.DEFAULT_MODELS

        last_error = None

        for model_name in models_to_try:
            for attempt in range(max_retries):
                # Apply proactive client-side rate limiting
                cls._enforce_rate_limit()

                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

                parts: list[dict[str, Any]] = []
                if image_bytes:
                    b64_img = base64.b64encode(image_bytes).decode("utf-8")
                    parts.append({"inline_data": {"mime_type": mime_type, "data": b64_img}})
                parts.append({"text": prompt})

                req_body = {
                    "contents": [{"role": "user", "parts": parts}],
                    "generationConfig": {
                        "maxOutputTokens": max_output_tokens,
                        "temperature": temperature,
                    },
                }

                req = urllib.request.Request(
                    url,
                    data=json.dumps(req_body).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )

                try:
                    with urllib.request.urlopen(req, timeout=35) as resp:
                        resp_data = json.loads(resp.read().decode("utf-8"))
                        candidates = resp_data.get("candidates", [])
                        if candidates:
                            content_parts = candidates[0].get("content", {}).get("parts", [])
                            if content_parts:
                                return content_parts[0].get("text", "")
                        return ""

                except urllib.error.HTTPError as http_err:
                    last_error = http_err
                    if http_err.code == 429:
                        wait_seconds = cls._parse_retry_delay(http_err, attempt)
                        logger.warning(
                            "AIGateway: Gemini quota limit reached (HTTP 429) on model '%s'. "
                            "Waiting %.2f seconds for quota to refresh before auto-retrying (attempt %d/%d)...",
                            model_name,
                            wait_seconds,
                            attempt + 1,
                            max_retries,
                        )
                        time.sleep(wait_seconds)
                        continue  # Auto-retry with refreshed quota window

                    elif http_err.code == 404:
                        logger.warning("AIGateway: Model '%s' returned 404; advancing to next model in chain.", model_name)
                        break  # Advance to next model candidate immediately

                    elif http_err.code in (500, 503):
                        wait_seconds = (2 ** attempt) + random.uniform(0.5, 1.5)
                        logger.warning("AIGateway: Transient server error %d. Retrying in %.2fs...", http_err.code, wait_seconds)
                        time.sleep(wait_seconds)
                        continue

                    else:
                        logger.error("AIGateway: HTTP error %d from Gemini API: %s", http_err.code, http_err.reason)
                        raise http_err

                except Exception as exc:
                    last_error = exc
                    logger.warning("AIGateway: Call error on model '%s' (attempt %d): %s", model_name, attempt + 1, exc)
                    time.sleep(1.0 + attempt)
                    continue

        raise GeminiQuotaExceededError(
            f"All Gemini models and retries failed. Last error: {last_error}"
        )

    @classmethod
    def generate_json(
        cls,
        prompt: str,
        image_bytes: bytes | None = None,
        mime_type: str = "image/jpeg",
        max_output_tokens: int = 600,
        temperature: float = 0.1,
        model_candidates: list[str] | None = None,
        max_retries: int = 3,
    ) -> dict | None:
        """
        Executes generate_content and parses the response as structured JSON.
        Handles markdown json wrappers automatically.
        """
        raw_text = cls.generate_content(
            prompt=prompt,
            image_bytes=image_bytes,
            mime_type=mime_type,
            max_output_tokens=max_output_tokens,
            temperature=temperature,
            model_candidates=model_candidates,
            max_retries=max_retries,
        )

        return cls.parse_json_from_text(raw_text)

    @staticmethod
    def parse_json_from_text(text: str) -> dict | None:
        """Extracts JSON object from text or markdown code fence blocks."""
        if not text:
            return None

        clean_text = text.strip()
        if clean_text.startswith("```"):
            lines = clean_text.splitlines()
            clean_text = "\n".join(
                line for line in lines
                if not line.strip().startswith("```")
            ).strip()

        try:
            return json.loads(clean_text)
        except json.JSONDecodeError:
            # Try finding outermost JSON brackets
            start = clean_text.find("{")
            end = clean_text.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    return json.loads(clean_text[start:end])
                except json.JSONDecodeError:
                    pass

        logger.warning("AIGateway: Unable to parse JSON from response text: %s", text[:200])
        return None
