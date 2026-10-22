from datetime import timedelta
from decimal import Decimal
from django.db.models import Sum, Q, Count
from django.utils import timezone
from ..models import Transaction, SavingsGoal, PeerDebt, Category


class AnalyticsService:
    @staticmethod
    def get_summary():
        """Computes all top-level card stats for the dashboard."""
        tx_stats = Transaction.objects.aggregate(
            total_income=Sum(
                "amount", filter=Q(type=Transaction.TransactionType.CREDIT)
            ),
            total_expense=Sum(
                "amount", filter=Q(type=Transaction.TransactionType.DEBIT)
            ),
            total_tx_count=Count("id"),
        )

        total_income = tx_stats["total_income"] or Decimal("0.00")
        total_expense = tx_stats["total_expense"] or Decimal("0.00")
        net_balance = total_income - total_expense

        # Savings
        savings_stats = SavingsGoal.objects.aggregate(
            total_saved=Sum("current_amount"),
            total_target=Sum("target_amount"),
            active_goals_count=Count("id", filter=Q(is_completed=False)),
        )
        total_saved = savings_stats["total_saved"] or Decimal("0.00")
        total_target = savings_stats["total_target"] or Decimal("0.00")

        # Peer Debts
        debt_stats = PeerDebt.objects.aggregate(
            total_given=Sum(
                "initial_amount", filter=Q(debt_type=PeerDebt.DebtType.GIVEN)
            ),
            remainder_to_receive=Sum(
                "remaining_amount",
                filter=Q(
                    debt_type=PeerDebt.DebtType.GIVEN,
                    status__in=[
                        PeerDebt.Status.PENDING,
                        PeerDebt.Status.PARTIALLY_SETTLED,
                    ],
                ),
            ),
            total_borrowed=Sum(
                "initial_amount", filter=Q(debt_type=PeerDebt.DebtType.BORROWED)
            ),
            remainder_to_pay=Sum(
                "remaining_amount",
                filter=Q(
                    debt_type=PeerDebt.DebtType.BORROWED,
                    status__in=[
                        PeerDebt.Status.PENDING,
                        PeerDebt.Status.PARTIALLY_SETTLED,
                    ],
                ),
            ),
        )

        total_given = debt_stats["total_given"] or Decimal("0.00")
        remainder_to_receive = (
            debt_stats["remainder_to_receive"] or Decimal("0.00")
        )
        total_borrowed = debt_stats["total_borrowed"] or Decimal("0.00")
        remainder_to_pay = debt_stats["remainder_to_pay"] or Decimal("0.00")

        # Cash balance from transactions
        cash_balance = total_income - total_expense
        # Net peer remainder: receivables (need to pay me) minus payables (borrowed)
        net_peer_remainder = remainder_to_receive - remainder_to_pay
        # Total Amount / Net Balance reflects cash + money need to pay me - money borrowed
        total_amount = cash_balance + net_peer_remainder

        return {
            "total_income": float(total_income),
            "total_expense": float(total_expense),
            "cash_balance": float(cash_balance),
            "net_balance": float(total_amount),
            "total_amount": float(total_amount),
            "total_saved": float(total_saved),
            "total_target_savings": float(total_target),
            "total_amount_given": float(total_given),
            "remainder_to_receive": float(remainder_to_receive),
            "total_amount_borrowed": float(total_borrowed),
            "remainder_to_pay": float(remainder_to_pay),
            "net_peer_remainder": float(net_peer_remainder),
        }

    @staticmethod
    def get_trends(days=30):
        """Generates daily trend series for spend, income, and amount given."""
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)

        # Query transactions in window
        txs = (
            Transaction.objects.filter(date__gte=start_date, date__lte=end_date)
            .values("date", "type")
            .annotate(total=Sum("amount"))
            .order_by("date")
        )

        # Query debts given in window
        debts = (
            PeerDebt.objects.filter(
                created_at__date__gte=start_date,
                created_at__date__lte=end_date,
                debt_type=PeerDebt.DebtType.GIVEN,
            )
            .values("created_at__date")
            .annotate(total=Sum("initial_amount"))
            .order_by("created_at__date")
        )

        tx_map = {}
        for item in txs:
            d_str = item["date"].strftime("%Y-%m-%d")
            if d_str not in tx_map:
                tx_map[d_str] = {"spend": 0.0, "income": 0.0}
            if item["type"] == Transaction.TransactionType.DEBIT:
                tx_map[d_str]["spend"] += float(item["total"])
            elif item["type"] == Transaction.TransactionType.CREDIT:
                tx_map[d_str]["income"] += float(item["total"])

        debt_map = {}
        for item in debts:
            d_str = item["created_at__date"].strftime("%Y-%m-%d")
            debt_map[d_str] = float(item["total"])

        # Build full date sequence
        series = []
        curr = start_date
        total_period_spend = 0.0
        total_period_income = 0.0
        total_period_given = 0.0

        while curr <= end_date:
            d_str = curr.strftime("%Y-%m-%d")
            day_data = tx_map.get(d_str, {"spend": 0.0, "income": 0.0})
            spend_val = round(day_data["spend"], 2)
            income_val = round(day_data["income"], 2)
            given_val = round(debt_map.get(d_str, 0.0), 2)

            total_period_spend += spend_val
            total_period_income += income_val
            total_period_given += given_val

            series.append(
                {
                    "date": d_str,
                    "spend": spend_val,
                    "income": income_val,
                    "amount_given": given_val,
                }
            )
            curr += timedelta(days=1)

        return {
            "period_days": days,
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "total_spend": round(total_period_spend, 2),
            "total_income": round(total_period_income, 2),
            "total_given": round(total_period_given, 2),
            "series": series,
        }

    @staticmethod
    def get_category_breakdown():
        """Computes expense and income category distributions."""
        categories = (
            Transaction.objects.values(
                "type",
                "category__id",
                "category__name",
                "category__color",
                "category__icon",
            )
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("-total")
        )

        expense_cats = []
        income_cats = []
        total_expense = Decimal("0.00")
        total_income = Decimal("0.00")

        for item in categories:
            amt = item["total"] or Decimal("0.00")
            cat_dict = {
                "category_id": item["category__id"],
                "category_name": item["category__name"] or "Uncategorized",
                "color": item["category__color"] or "#6B7280",
                "icon": item["category__icon"] or "folder",
                "amount": float(amt),
                "transaction_count": item["count"],
            }
            if item["type"] == Transaction.TransactionType.DEBIT:
                expense_cats.append(cat_dict)
                total_expense += amt
            elif item["type"] == Transaction.TransactionType.CREDIT:
                income_cats.append(cat_dict)
                total_income += amt

        # Add percentage
        for cat in expense_cats:
            cat["percentage"] = (
                round((cat["amount"] / float(total_expense)) * 100, 1)
                if total_expense > 0
                else 0.0
            )

        for cat in income_cats:
            cat["percentage"] = (
                round((cat["amount"] / float(total_income)) * 100, 1)
                if total_income > 0
                else 0.0
            )

        return {
            "expenses": {
                "total": float(total_expense),
                "breakdown": expense_cats,
            },
            "incomes": {
                "total": float(total_income),
                "breakdown": income_cats,
            },
        }

    @staticmethod
    def get_who_owes_summary():
        """Returns ordered active list of who needs to give how much."""
        debts = (
            PeerDebt.objects.filter(
                debt_type=PeerDebt.DebtType.GIVEN,
                status__in=[
                    PeerDebt.Status.PENDING,
                    PeerDebt.Status.PARTIALLY_SETTLED,
                ],
            )
            .order_by("-remaining_amount")
        )

        results = []
        total_receivable = Decimal("0.00")
        overdue_count = 0

        for d in debts:
            total_receivable += d.remaining_amount
            if d.is_overdue:
                overdue_count += 1

            results.append(
                {
                    "id": d.id,
                    "person_name": d.person_name,
                    "phone_or_contact": d.phone_or_contact,
                    "initial_amount": float(d.initial_amount),
                    "settled_amount": float(d.settled_amount),
                    "remainder_due": float(d.remaining_amount),
                    "due_date": d.due_date.strftime("%Y-%m-%d") if d.due_date else None,
                    "days_until_due": d.days_until_due,
                    "is_overdue": d.is_overdue,
                    "status": d.status,
                    "notes": d.notes,
                    "created_at": d.created_at.strftime("%Y-%m-%d"),
                }
            )

        return {
            "total_receivable": float(total_receivable),
            "debtor_count": len(results),
            "overdue_count": overdue_count,
            "who_owes_list": results,
        }

