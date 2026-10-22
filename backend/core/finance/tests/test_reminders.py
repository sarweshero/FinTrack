from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from core.finance.models import PeerDebt


class RemindersAPITests(APITestCase):
    def setUp(self):
        today = timezone.now().date()
        # Given by me (They owe me)
        self.debt_given = PeerDebt.objects.create(
            person_name="Alice",
            debt_type=PeerDebt.DebtType.GIVEN,
            initial_amount=Decimal("500.00"),
            remaining_amount=Decimal("300.00"),  # 200 settled
            due_date=today + timedelta(days=5),
            status=PeerDebt.Status.PARTIALLY_SETTLED,
            notes="Weekend trip split",
        )
        # Given to me (I owe them) - Overdue
        self.debt_taken = PeerDebt.objects.create(
            person_name="Bob",
            debt_type=PeerDebt.DebtType.BORROWED,
            initial_amount=Decimal("200.00"),
            remaining_amount=Decimal("200.00"),
            due_date=today - timedelta(days=2),  # overdue
            status=PeerDebt.Status.PENDING,
            notes="Laptop repair",
        )

    def test_reminders_page_endpoint(self):
        res = self.client.get("/api/reminders/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        summary = data["summary"]

        # Given by me checks
        self.assertEqual(summary["given_by_me"]["remainder_to_receive"], 300.0)
        self.assertEqual(summary["given_by_me"]["total_amount_given"], 500.0)
        self.assertEqual(summary["given_by_me"]["total_received_back"], 200.0)
        self.assertEqual(len(data["amount_given_by_me"]), 1)
        self.assertEqual(data["amount_given_by_me"][0]["person_name"], "Alice")
        self.assertFalse(data["amount_given_by_me"][0]["is_overdue"])

        # Given to me checks
        self.assertEqual(summary["given_to_me"]["remainder_to_pay"], 200.0)
        self.assertEqual(summary["given_to_me"]["total_amount_taken"], 200.0)
        self.assertEqual(len(data["amount_given_to_me"]), 1)
        self.assertEqual(data["amount_given_to_me"][0]["person_name"], "Bob")
        self.assertTrue(data["amount_given_to_me"][0]["is_overdue"])

        # Net remainder: 300 - 200 = 100
        self.assertEqual(summary["net_remainder"], 100.0)
        self.assertEqual(summary["net_position"], "RECEIVABLE")

    def test_reminders_overdue_filter(self):
        res = self.client.get("/api/reminders/?overdue_only=true")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Only Bob is overdue
        self.assertEqual(len(res.data["amount_given_by_me"]), 0)
        self.assertEqual(len(res.data["amount_given_to_me"]), 1)
        self.assertEqual(res.data["amount_given_to_me"][0]["person_name"], "Bob")

