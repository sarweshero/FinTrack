from decimal import Decimal
from rest_framework import status
from rest_framework.test import APITestCase
from core.finance.models import Category, Transaction, PeerDebt, SavingsGoal


class DashboardAPITests(APITestCase):
    def setUp(self):
        self.cat_food = Category.objects.create(
            name="Food",
            type=Category.CategoryType.EXPENSE,
            icon="utensils",
            color="#EF4444",
        )
        self.cat_sal = Category.objects.create(
            name="Salary",
            type=Category.CategoryType.INCOME,
            icon="briefcase",
            color="#10B981",
        )

        Transaction.objects.create(
            type=Transaction.TransactionType.CREDIT,
            title="Monthly Pay",
            amount=Decimal("3000.00"),
            category=self.cat_sal,
        )
        Transaction.objects.create(
            type=Transaction.TransactionType.DEBIT,
            title="Groceries & Meals",
            amount=Decimal("450.00"),
            category=self.cat_food,
        )
        SavingsGoal.objects.create(
            title="Emergency Fund",
            target_amount=Decimal("5000.00"),
            current_amount=Decimal("1200.00"),
        )
        PeerDebt.objects.create(
            person_name="Charlie",
            debt_type=PeerDebt.DebtType.GIVEN,
            initial_amount=Decimal("300.00"),
            remaining_amount=Decimal("300.00"),
        )
        PeerDebt.objects.create(
            person_name="Dave",
            debt_type=PeerDebt.DebtType.BORROWED,
            initial_amount=Decimal("100.00"),
            remaining_amount=Decimal("100.00"),
        )

    def test_dashboard_summary(self):
        res = self.client.get("/api/dashboard/summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data["total_income"], 3000.0)
        self.assertEqual(data["total_expense"], 450.0)
        self.assertEqual(data["cash_balance"], 2550.0)
        self.assertEqual(data["remainder_to_receive"], 300.0)
        self.assertEqual(data["remainder_to_pay"], 100.0)
        self.assertEqual(data["net_peer_remainder"], 200.0)
        # Total amount = Cash ($2550) + To Receive ($300) - Borrowed ($100) = $2750
        self.assertEqual(data["total_amount"], 2750.0)
        self.assertEqual(data["net_balance"], 2750.0)
        self.assertEqual(data["total_saved"], 1200.0)
        self.assertEqual(data["total_amount_given"], 300.0)

    def test_dashboard_trends(self):
        res = self.client.get("/api/dashboard/trends/?days=7")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data["period_days"], 7)
        self.assertEqual(len(data["series"]), 7)
        self.assertEqual(data["total_spend"], 450.0)
        self.assertEqual(data["total_income"], 3000.0)

    def test_dashboard_categories(self):
        res = self.client.get("/api/dashboard/categories/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data["expenses"]["total"], 450.0)
        self.assertEqual(data["incomes"]["total"], 3000.0)
        self.assertEqual(len(data["expenses"]["breakdown"]), 1)
        self.assertEqual(data["expenses"]["breakdown"][0]["category_name"], "Food")

    def test_dashboard_who_owes(self):
        res = self.client.get("/api/dashboard/who-owes/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data["debtor_count"], 1)
        self.assertEqual(data["total_receivable"], 300.0)
        self.assertEqual(data["who_owes_list"][0]["person_name"], "Charlie")

