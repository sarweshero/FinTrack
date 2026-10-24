"""
Tests for AIGateway and CategoryMapperService.
Verifies:
1. AIGateway 429 Rate/Quota limit handling: waits for quota refresh and auto-retries.
2. CategoryMapperService fast keyword heuristics (Zero Quota).
3. CategoryMapperService AI mapping via AIGateway.
4. /api/categories/suggest/ endpoint.
5. Auto-mapping category on Transaction creation when category is omitted.
"""

import json
import urllib.error
from unittest.mock import MagicMock, patch
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from ..models import Category, Transaction
from ..services.ai_gateway import AIGateway
from ..services.category_mapper_service import CategoryMapperService


class AIGatewayRetryTestCase(TestCase):
    """Test AIGateway automatic retry behavior when encountering HTTP 429."""

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_429_auto_retry_and_success(self, mock_urlopen, mock_sleep):
        """Simulate HTTP 429 on first attempt, then success on auto-retry."""
        # 1st attempt: 429 error
        err_429 = urllib.error.HTTPError(
            url="http://test",
            code=429,
            msg="Quota exceeded",
            hdrs={"Retry-After": "15"},
            fp=None,
        )

        # 2nd attempt: Success response
        success_resp = MagicMock()
        success_resp.read.return_value = json.dumps({
            "candidates": [{
                "content": {
                    "parts": [{"text": '{"category_id": 1, "confidence": "high"}'}]
                }
            }]
        }).encode("utf-8")
        success_resp.__enter__.return_value = success_resp

        mock_urlopen.side_effect = [err_429, success_resp]

        result = AIGateway.generate_content("test prompt", max_retries=2)

        self.assertIn("category_id", result)
        # Verify it slept before retrying
        mock_sleep.assert_called()
        self.assertEqual(mock_urlopen.call_count, 2)


class CategoryMapperTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat_food = Category.objects.create(name="Food & Dining", type="EXPENSE")
        self.cat_fuel = Category.objects.create(name="Fuel & Transport", type="EXPENSE")
        self.cat_grocery = Category.objects.create(name="Groceries", type="EXPENSE")
        self.cat_salary = Category.objects.create(name="Salary & Income", type="INCOME")

    def test_heuristic_zero_quota_matching(self):
        """Merchants like Swiggy, DMart, Shell must map immediately without AI calls."""
        res_swiggy = CategoryMapperService.suggest_category("Swiggy lunch order", "", "DEBIT")
        self.assertEqual(res_swiggy["category_id"], self.cat_food.id)
        self.assertEqual(res_swiggy["confidence"], "high")

        res_fuel = CategoryMapperService.suggest_category("Shell petrol bunk", "", "DEBIT")
        self.assertEqual(res_fuel["category_id"], self.cat_fuel.id)

        res_salary = CategoryMapperService.suggest_category("Monthly salary credited", "", "CREDIT")
        self.assertEqual(res_salary["category_id"], self.cat_salary.id)

    @patch.object(AIGateway, "generate_json")
    def test_ai_fallback_mapping(self, mock_generate_json):
        """Obscure descriptions trigger AI mapping via AIGateway."""
        mock_generate_json.return_value = {
            "category_id": self.cat_food.id,
            "category_name": "Food & Dining",
            "confidence": "high",
            "reason": "Artisan cafe meal",
        }

        res = CategoryMapperService.suggest_category("Artisan handcrafted avocado toast at boutique bistro", "", "DEBIT")
        self.assertEqual(res["category_id"], self.cat_food.id)
        mock_generate_json.assert_called_once()

    def test_suggest_endpoint(self):
        """API endpoint /api/categories/suggest/ works."""
        response = self.client.post(
            "/api/categories/suggest/",
            {"title": "Swiggy order", "description": "dinner", "type": "DEBIT"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["category_id"], self.cat_food.id)

    def test_auto_map_on_transaction_serializer(self):
        """Creating transaction with category=None auto-maps category by title."""
        response = self.client.post(
            "/api/transactions/",
            {
                "title": "Swiggy dinner feast",
                "amount": "450.00",
                "type": "DEBIT",
                "payment_method": "UPI",
                "date": "2026-10-24",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["category"], self.cat_food.id)
        self.assertEqual(response.data["category_details"]["name"], "Food & Dining")

