from decimal import Decimal
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase
from core.finance.models import Transaction, AIReportCache
from core.finance.services.gemini_service import GeminiService


class AIReportAPITests(APITestCase):
    def setUp(self):
        Transaction.objects.create(
            type=Transaction.TransactionType.CREDIT,
            title="Salary",
            amount=Decimal("4000.00"),
        )
        Transaction.objects.create(
            type=Transaction.TransactionType.DEBIT,
            title="Rent",
            amount=Decimal("1200.00"),
        )

    def test_ai_report_fallback_when_no_api_key(self):
        """Ensures that the endpoint generates a reliable financial report even without a live Gemini key."""
        with self.settings(GEMINI_API_KEY=""):
            res = self.client.get("/api/ai-report/")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            data = res.data

            self.assertIn("content_markdown", data)
            self.assertIn("content_json", data)
            self.assertIn("health_score", data["content_json"])
            self.assertEqual(data["source"], "heuristic_fallback (no API key configured)")
            self.assertEqual(AIReportCache.objects.count(), 1)

    def test_ai_report_caching(self):
        """Verifies that consecutive requests return the cached report without extra computation or API calls."""
        with self.settings(GEMINI_API_KEY=""):
            res1 = self.client.get("/api/ai-report/")
            self.assertEqual(res1.status_code, status.HTTP_200_OK)
            self.assertEqual(AIReportCache.objects.count(), 1)

            # Second request should be served from cache
            res2 = self.client.get("/api/ai-report/")
            self.assertEqual(res2.status_code, status.HTTP_200_OK)
            self.assertEqual(res2.data["source"], "cache")
            self.assertEqual(AIReportCache.objects.count(), 1)

    @patch.object(GeminiService, "_call_gemini_api")
    def test_ai_report_quota_exceeded_fallback(self, mock_call):
        """Verifies that if Gemini throws ResourceExhausted (HTTP 429), it falls back seamlessly."""
        mock_call.side_effect = Exception("429 ResourceExhausted: Quota exceeded")

        with self.settings(GEMINI_API_KEY="test_key_exhausted"):
            res = self.client.post("/api/ai-report/")  # force refresh
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            data = res.data
            self.assertIn("quota/api limit safeguard", data["source"])
            self.assertIn("health_score", data["content_json"])
