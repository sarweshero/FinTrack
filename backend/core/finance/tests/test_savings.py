from decimal import Decimal
from rest_framework import status
from rest_framework.test import APITestCase
from core.finance.models import SavingsGoal, SavingsDeposit


class SavingsAPITests(APITestCase):
    def setUp(self):
        self.goal = SavingsGoal.objects.create(
            title="Emergency Fund",
            target_amount=Decimal("1000.00"),
            current_amount=Decimal("200.00"),
        )

    def test_list_and_create_goal(self):
        res = self.client.get("/api/savings/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

        create_res = self.client.post(
            "/api/savings/",
            {"title": "Vacation", "target_amount": "1500.00"},
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_res.data["progress_percentage"], 0.0)

    def test_deposit_action(self):
        payload = {"amount": "300.00", "notes": "End of month deposit"}
        res = self.client.post(f"/api/savings/{self.goal.id}/deposit/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.goal.refresh_from_db()
        self.assertEqual(self.goal.current_amount, Decimal("500.00"))
        self.assertEqual(self.goal.progress_percentage, 50.0)
        self.assertFalse(self.goal.is_completed)

        # Deposit remaining to complete goal
        self.client.post(f"/api/savings/{self.goal.id}/deposit/", {"amount": "500.00"})
        self.goal.refresh_from_db()
        self.assertEqual(self.goal.current_amount, Decimal("1000.00"))
        self.assertTrue(self.goal.is_completed)

