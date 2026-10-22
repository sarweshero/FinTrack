from decimal import Decimal
from django.db.models import Sum, Q, Count
from ..models import PeerDebt


class ReminderService:
    @staticmethod
    def get_reminders_overview(overdue_only=False, search_query=None):
        """
        Builds the complete dataset for the Reminders page:
        1. Amount given by me (Receivables / Dues to collect)
        2. Amount given to me (Payables / Dues to return)
        3. Aggregated summaries and net remainder balance.
        """
        # Base querysets
        given_by_me_qs = PeerDebt.objects.filter(
            debt_type=PeerDebt.DebtType.GIVEN,
            status__in=[
                PeerDebt.Status.PENDING,
                PeerDebt.Status.PARTIALLY_SETTLED,
            ],
        )

        given_to_me_qs = PeerDebt.objects.filter(
            debt_type=PeerDebt.DebtType.BORROWED,
            status__in=[
                PeerDebt.Status.PENDING,
                PeerDebt.Status.PARTIALLY_SETTLED,
            ],
        )

        if search_query:
            search_filter = Q(person_name__icontains=search_query) | Q(
                notes__icontains=search_query
            )
            given_by_me_qs = given_by_me_qs.filter(search_filter)
            given_to_me_qs = given_to_me_qs.filter(search_filter)

        # Totals for all records (unfiltered by overdue_only)
        stats_given_by_me = PeerDebt.objects.filter(
            debt_type=PeerDebt.DebtType.GIVEN
        ).aggregate(
            total_given=Sum("initial_amount"),
            remainder_to_receive=Sum(
                "remaining_amount",
                filter=Q(
                    status__in=[
                        PeerDebt.Status.PENDING,
                        PeerDebt.Status.PARTIALLY_SETTLED,
                    ]
                ),
            ),
        )

        stats_given_to_me = PeerDebt.objects.filter(
            debt_type=PeerDebt.DebtType.BORROWED
        ).aggregate(
            total_taken=Sum("initial_amount"),
            remainder_to_pay=Sum(
                "remaining_amount",
                filter=Q(
                    status__in=[
                        PeerDebt.Status.PENDING,
                        PeerDebt.Status.PARTIALLY_SETTLED,
                    ]
                ),
            ),
        )

        total_amount_given = stats_given_by_me["total_given"] or Decimal("0.00")
        remainder_to_receive = (
            stats_given_by_me["remainder_to_receive"] or Decimal("0.00")
        )
        total_received_back = total_amount_given - remainder_to_receive

        total_amount_taken = stats_given_to_me["total_taken"] or Decimal("0.00")
        remainder_to_pay = (
            stats_given_to_me["remainder_to_pay"] or Decimal("0.00")
        )
        total_repaid = total_amount_taken - remainder_to_pay

        # Format items
        def format_debt_item(debt):
            return {
                "id": debt.id,
                "person_name": debt.person_name,
                "phone_or_contact": debt.phone_or_contact,
                "initial_amount": float(debt.initial_amount),
                "settled_amount": float(debt.settled_amount),
                "remainder_amount": float(debt.remaining_amount),
                "due_date": debt.due_date.strftime("%Y-%m-%d") if debt.due_date else None,
                "days_until_due": debt.days_until_due,
                "is_overdue": debt.is_overdue,
                "status": debt.status,
                "notes": debt.notes,
                "created_at": debt.created_at.strftime("%Y-%m-%d"),
            }

        given_by_me_items = [format_debt_item(d) for d in given_by_me_qs.order_by("due_date", "-remaining_amount")]
        given_to_me_items = [format_debt_item(d) for d in given_to_me_qs.order_by("due_date", "-remaining_amount")]

        if overdue_only:
            given_by_me_items = [item for item in given_by_me_items if item["is_overdue"]]
            given_to_me_items = [item for item in given_to_me_items if item["is_overdue"]]

        overdue_given_by_me_count = sum(1 for item in given_by_me_items if item["is_overdue"])
        overdue_given_to_me_count = sum(1 for item in given_to_me_items if item["is_overdue"])

        net_remainder = remainder_to_receive - remainder_to_pay
        if net_remainder > 0:
            net_position = "RECEIVABLE"
        elif net_remainder < 0:
            net_position = "PAYABLE"
        else:
            net_position = "BALANCED"

        return {
            "summary": {
                "given_by_me": {
                    "title": "Amount Given by Me",
                    "description": "Money lent to others that needs to be collected",
                    "total_amount_given": float(total_amount_given),
                    "total_received_back": float(max(Decimal("0.00"), total_received_back)),
                    "remainder_to_receive": float(remainder_to_receive),
                    "active_borrowers_count": len(given_by_me_items),
                    "overdue_count": overdue_given_by_me_count,
                },
                "given_to_me": {
                    "title": "Amount Given to Me",
                    "description": "Money borrowed from others that needs to be repaid",
                    "total_amount_taken": float(total_amount_taken),
                    "total_repaid": float(max(Decimal("0.00"), total_repaid)),
                    "remainder_to_pay": float(remainder_to_pay),
                    "active_lenders_count": len(given_to_me_items),
                    "overdue_count": overdue_given_to_me_count,
                },
                "net_remainder": float(net_remainder),
                "net_position": net_position,
            },
            "amount_given_by_me": given_by_me_items,
            "amount_given_to_me": given_to_me_items,
        }

