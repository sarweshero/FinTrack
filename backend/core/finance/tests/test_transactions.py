from decimal import Decimal
from rest_framework import status
from rest_framework.test import APITestCase
from core.finance.models import Category, Transaction


class TransactionAPITests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(
            name="Groceries",
            type=Category.CategoryType.EXPENSE,
            icon="shopping-cart",
            color="#10B981",
        )
        self.income_cat = Category.objects.create(
            name="Salary",
            type=Category.CategoryType.INCOME,
            icon="briefcase",
            color="#059669",
        )

    def test_create_debit_transaction(self):
        payload = {
            "title": "Supermarket Shopping",
            "amount": "145.50",
            "category": self.category.id,
            "payment_method": "UPI",
            "date": "2026-10-20",
        }
        response = self.client.post("/api/debit/", payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["type"], "DEBIT")
        self.assertEqual(response.data["amount"], "145.50")
        self.assertEqual(response.data["title"], "Supermarket Shopping")

    def test_create_credit_transaction(self):
        payload = {
            "title": "Monthly Salary",
            "amount": "3500.00",
            "category": self.income_cat.id,
            "payment_method": "BANK_TRANSFER",
            "date": "2026-10-01",
        }
        response = self.client.post("/api/credit/", payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["type"], "CREDIT")
        self.assertEqual(response.data["amount"], "3500.00")

    def test_debit_endpoint_only_lists_debits(self):
        Transaction.objects.create(
            type=Transaction.TransactionType.DEBIT,
            title="Coffee",
            amount=Decimal("4.50"),
        )
        Transaction.objects.create(
            type=Transaction.TransactionType.CREDIT,
            title="Freelance",
            amount=Decimal("400.00"),
        )

        response = self.client.get("/api/debit/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for item in response.data:
            self.assertEqual(item["type"], "DEBIT")

    def test_unified_transactions_endpoint(self):
        Transaction.objects.create(
            type=Transaction.TransactionType.DEBIT,
            title="Lunch",
            amount=Decimal("15.00"),
        )
        Transaction.objects.create(
            type=Transaction.TransactionType.CREDIT,
            title="Bonus",
            amount=Decimal("500.00"),
        )

        response = self.client.get("/api/transactions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 2)

        # Filter by type
        filter_res = self.client.get("/api/transactions/?type=CREDIT")
        filter_results = filter_res.data.get("results", filter_res.data)
        self.assertEqual(len(filter_results), 1)
        self.assertEqual(filter_results[0]["title"], "Bonus")

