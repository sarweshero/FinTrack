from decimal import Decimal
from rest_framework import status
from rest_framework.test import APITestCase
from core.finance.models import PeerDebt, DebtSettlement


class PeerDebtAPITests(APITestCase):
    def setUp(self):
        self.debt = PeerDebt.objects.create(
            person_name="David Miller",
            debt_type=PeerDebt.DebtType.GIVEN,
            initial_amount=Decimal("300.00"),
            remaining_amount=Decimal("300.00"),
            due_date="2026-11-15",
            notes="Concert tickets advance",
        )

    def test_create_peer_debt(self):
        payload = {
            "person_name": "Sarah Connor",
            "debt_type": "GIVEN",
            "initial_amount": "150.00",
            "due_date": "2026-10-30",
        }
        res = self.client.post("/api/debts/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["remaining_amount"], "150.00")
        self.assertEqual(res.data["status"], "PENDING")

    def test_partial_settle_action(self):
        payload = {"amount": "100.00", "notes": "First installment"}
        res = self.client.post(f"/api/debts/{self.debt.id}/settle/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.debt.refresh_from_db()
        self.assertEqual(self.debt.remaining_amount, Decimal("200.00"))
        self.assertEqual(self.debt.settled_amount, Decimal("100.00"))
        self.assertEqual(self.debt.status, PeerDebt.Status.PARTIALLY_SETTLED)

    def test_full_settlement(self):
        payload = {"amount": "300.00", "notes": "Full payoff"}
        res = self.client.post(f"/api/debts/{self.debt.id}/settle/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.debt.refresh_from_db()
        self.assertEqual(self.debt.remaining_amount, Decimal("0.00"))
        self.assertEqual(self.debt.status, PeerDebt.Status.SETTLED)

    def test_who_owes_me_endpoint(self):
        res = self.client.get("/api/debts/who_owes_me/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["debtor_count"], 1)
        self.assertEqual(res.data["total_receivable"], 300.0)
        self.assertEqual(res.data["who_owes_list"][0]["person_name"], "David Miller")

