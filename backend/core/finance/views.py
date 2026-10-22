from decimal import Decimal
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Category,
    Transaction,
    SavingsGoal,
    SavingsDeposit,
    PeerDebt,
    DebtSettlement,
)
from .serializers import (
    CategorySerializer,
    TransactionSerializer,
    DebitTransactionSerializer,
    CreditTransactionSerializer,
    SavingsGoalSerializer,
    SavingsDepositSerializer,
    DepositActionSerializer,
    PeerDebtSerializer,
    DebtSettlementSerializer,
    DebtSettleActionSerializer,
    AIReportSerializer,
)
from .services.analytics_service import AnalyticsService
from .services.reminder_service import ReminderService
from .services.gemini_service import GeminiService
from .services.bill_scanner_service import BillScannerService


class CategoryViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Categories.
    Supports filtering by type (?type=EXPENSE or ?type=INCOME).
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        cat_type = self.request.query_params.get("type")
        if cat_type:
            cat_type = cat_type.upper()
            qs = qs.filter(Q(type=cat_type) | Q(type=Category.CategoryType.BOTH))
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


class DebitViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet specifically for Debit (Expense) transactions.
    """

    queryset = Transaction.objects.filter(type=Transaction.TransactionType.DEBIT)
    serializer_class = DebitTransactionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        start_date = self.request.query_params.get("start_date")
        if start_date:
            qs = qs.filter(date__gte=start_date)
        end_date = self.request.query_params.get("end_date")
        if end_date:
            qs = qs.filter(date__lte=end_date)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        return qs


class CreditViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet specifically for Credit (Income) transactions.
    """

    queryset = Transaction.objects.filter(type=Transaction.TransactionType.CREDIT)
    serializer_class = CreditTransactionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        start_date = self.request.query_params.get("start_date")
        if start_date:
            qs = qs.filter(date__gte=start_date)
        end_date = self.request.query_params.get("end_date")
        if end_date:
            qs = qs.filter(date__lte=end_date)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        return qs


class TransactionViewSet(viewsets.ModelViewSet):
    """
    Unified CRUD ViewSet for all Transactions (Debit & Credit).
    Supports rich filtering by type, category, date range, payment method, and search.
    """

    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        tx_type = self.request.query_params.get("type")
        if tx_type:
            qs = qs.filter(type=tx_type.upper())
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        payment_method = self.request.query_params.get("payment_method")
        if payment_method:
            qs = qs.filter(payment_method=payment_method.upper())
        start_date = self.request.query_params.get("start_date")
        if start_date:
            qs = qs.filter(date__gte=start_date)
        end_date = self.request.query_params.get("end_date")
        if end_date:
            qs = qs.filter(date__lte=end_date)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        return qs


class SavingsGoalViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Savings Goals with a deposit action.
    """

    queryset = SavingsGoal.objects.all()
    serializer_class = SavingsGoalSerializer

    @action(detail=True, methods=["post"])
    def deposit(self, request, pk=None):
        goal = self.get_object()
        serializer = DepositActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data["amount"]
        notes = serializer.validated_data.get("notes", "")
        deposit_date = serializer.validated_data.get("date", timezone.now().date())

        deposit = SavingsDeposit.objects.create(
            goal=goal,
            amount=amount,
            notes=notes,
            date=deposit_date,
        )

        goal.current_amount += amount
        if goal.current_amount >= goal.target_amount:
            goal.is_completed = True
        goal.save()

        return Response(
            {
                "message": f"Successfully deposited {amount} to '{goal.title}'",
                "deposit": SavingsDepositSerializer(deposit).data,
                "goal": SavingsGoalSerializer(goal).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PeerDebtViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Peer Debts (Amount given to others / Amount borrowed from others).
    """

    queryset = PeerDebt.objects.all()
    serializer_class = PeerDebtSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        debt_type = self.request.query_params.get("type")
        if debt_type:
            qs = qs.filter(debt_type=debt_type.upper())
        debt_status = self.request.query_params.get("status")
        if debt_status:
            qs = qs.filter(status=debt_status.upper())
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(person_name__icontains=search) | Q(notes__icontains=search)
            )
        return qs

    @action(detail=True, methods=["post"])
    def settle(self, request, pk=None):
        debt = self.get_object()
        serializer = DebtSettleActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data["amount"]
        notes = serializer.validated_data.get("notes", "")
        settled_at = serializer.validated_data.get(
            "settled_at", timezone.now().date()
        )

        settlement = DebtSettlement.objects.create(
            peer_debt=debt,
            amount=amount,
            notes=notes,
            settled_at=settled_at,
        )

        # Update remaining amount and status
        new_remaining = max(Decimal("0.00"), debt.remaining_amount - amount)
        debt.remaining_amount = new_remaining
        debt.save()

        return Response(
            {
                "message": f"Recorded payment of {amount} for {debt.person_name}",
                "settlement": DebtSettlementSerializer(settlement).data,
                "debt": PeerDebtSerializer(debt).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"])
    def who_owes_me(self, request):
        """Quick summary of who needs to give how much."""
        data = AnalyticsService.get_who_owes_summary()
        return Response(data)

    @action(detail=False, methods=["get"])
    def reminders(self, request):
        """Overview for reminders."""
        overdue_only = (
            request.query_params.get("overdue_only", "false").lower() == "true"
        )
        search = request.query_params.get("search")
        data = ReminderService.get_reminders_overview(
            overdue_only=overdue_only, search_query=search
        )
        return Response(data)


class RemindersView(APIView):
    """
    Dedicated endpoint for the Reminders Page:
    Shows Remainders for 'Amount given to me' and 'Amount given by me'.
    """

    def get(self, request):
        overdue_only = (
            request.query_params.get("overdue_only", "false").lower() == "true"
        )
        search = request.query_params.get("search")
        data = ReminderService.get_reminders_overview(
            overdue_only=overdue_only, search_query=search
        )
        return Response(data)


class DashboardSummaryView(APIView):
    def get(self, request):
        data = AnalyticsService.get_summary()
        return Response(data)


class DashboardTrendsView(APIView):
    def get(self, request):
        days = int(request.query_params.get("days", 30))
        data = AnalyticsService.get_trends(days=days)
        return Response(data)


class DashboardCategoriesView(APIView):
    def get(self, request):
        data = AnalyticsService.get_category_breakdown()
        return Response(data)


class DashboardWhoOwesView(APIView):
    def get(self, request):
        data = AnalyticsService.get_who_owes_summary()
        return Response(data)


class AIReportView(APIView):
    """
    Generates or fetches cached AI financial advisory report.
    Protected by DRF rate throttle and smart database caching.
    """

    throttle_scope = "ai_report"

    def get(self, request):
        force_refresh = (
            request.query_params.get("refresh", "false").lower() == "true"
        )
        report = GeminiService.generate_report(force_refresh=force_refresh)
        return Response(report)

    def post(self, request):
        # Explicit POST always requests fresh evaluation
        report = GeminiService.generate_report(force_refresh=True)
        return Response(report, status=status.HTTP_201_CREATED)


class BillScanView(APIView):
    """
    POST /api/scan-bill/
    Accepts a multipart/form-data image, compresses it aggressively in-memory
    (≤ 800 px, JPEG-50) before forwarding to Gemini Vision, and returns
    a structured transaction payload for the user to review and confirm.

    Quota safeguards
    ----------------
    • Hard rate-limit: 10 scans / hour (via DRF ScopedRateThrottle).
    • Image is never stored on disk — all processing happens in RAM.
    • Gemini output tokens capped at 512; prompt is < 150 tokens.
    """

    throttle_scope = "scan_bill"

    # Allow up to 10 MB uploads so real phone photos are accepted (they'll
    # be compressed down to ~50–80 KB before hitting the API).
    MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
    ALLOWED_CONTENT_TYPES = {
        "image/jpeg", "image/jpg", "image/png",
        "image/webp", "image/heic", "image/heif",
    }

    def post(self, request):
        image_file = request.FILES.get("image")
        if not image_file:
            return Response(
                {"error": "No image file provided. Send a multipart/form-data request with key 'image'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate content type
        content_type = (image_file.content_type or "").lower().split(";")[0].strip()
        if content_type not in self.ALLOWED_CONTENT_TYPES:
            return Response(
                {"error": f"Unsupported file type '{content_type}'. Use JPEG, PNG, WebP, or HEIC."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file size
        if image_file.size > self.MAX_UPLOAD_BYTES:
            return Response(
                {"error": f"File too large ({image_file.size // (1024*1024)} MB). Maximum is 10 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Read all bytes into memory (no disk I/O)
        raw_bytes = image_file.read()

        # Delegate to service (compresses + calls Gemini)
        result = BillScannerService.scan(raw_bytes)

        if not result.get("success"):
            return Response(
                {"error": result.get("error", "Scan failed.")},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(result, status=status.HTTP_200_OK)
