import threading
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse, parse_qs
from django.db import transaction as db_transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import CursorPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Category,
    Transaction,
    SavingsGoal,
    SavingsDeposit,
    PeerDebt,
    DebtSettlement,
    BillScanTask,
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
from .services.bill_scanner_service import (
    BillScannerService,
    process_bill_task_in_background,
)


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
        qs = super().get_queryset().select_related("category").prefetch_related("scan_tasks")
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
        qs = super().get_queryset().select_related("category").prefetch_related("scan_tasks")
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


class TransactionTokenPagination(CursorPagination):
    """
    Token/Cursor-based pagination for Transactions.
    Supports infinite scrolling with opaque tokens:
    ?token=<cursor_token>&page_size=15
    """

    page_size = 15
    page_size_query_param = "page_size"
    max_page_size = 50
    ordering = ("-date", "-id")
    cursor_query_param = "token"

    def get_paginated_response(self, data):
        next_url = self.get_next_link()
        next_token = None
        if next_url:
            query = parse_qs(urlparse(next_url).query)
            next_token = query.get(self.cursor_query_param, [None])[0]

        prev_url = self.get_previous_link()
        prev_token = None
        if prev_url:
            query = parse_qs(urlparse(prev_url).query)
            prev_token = query.get(self.cursor_query_param, [None])[0]

        return Response({
            "next": next_url,
            "next_token": next_token,
            "previous": prev_url,
            "previous_token": prev_token,
            "results": data,
        })


class TransactionViewSet(viewsets.ModelViewSet):
    """
    Unified CRUD ViewSet for all Transactions (Debit & Credit).
    Supports token-based cursor pagination, rich filtering, bill attachments,
    and product-level transaction splitting.
    """

    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    pagination_class = TransactionTokenPagination

    def paginate_queryset(self, queryset):
        # Allow disabling pagination if caller explicitly asks for all items
        if (
            self.request.query_params.get("paginate", "").lower() == "false"
            or self.request.query_params.get("all", "").lower() == "true"
        ):
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        qs = super().get_queryset().select_related("category").prefetch_related("scan_tasks")
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

    @action(detail=True, methods=["post"], url_path="upload-bill")
    def upload_bill(self, request, pk=None):
        """
        Upload a bill image directly to an existing transaction to extract
        its spending products / line items.
        """
        tx = self.get_object()
        image_file = request.FILES.get("image")
        if not image_file:
            return Response(
                {"error": "No image file provided. Send key 'image'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_bytes = image_file.read()
        result = BillScannerService.scan(raw_bytes)

        if not result.get("success"):
            return Response(
                {"error": result.get("error", "Scan failed.")},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        task = BillScanTask.objects.create(
            status=BillScanTask.Status.COMPLETED,
            extracted_data=result,
            transaction=tx,
        )

        return Response(
            {
                "success": True,
                "transaction_id": tx.id,
                "bill_data": {
                    "task_id": str(task.id),
                    "merchant": result.get("title"),
                    "confidence": result.get("confidence", "high"),
                    "line_items": result.get("line_items", []),
                    "payment_method": result.get("payment_method"),
                    "scanned_at": task.created_at.isoformat(),
                },
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="split")
    def split(self, request, pk=None):
        """
        Split an existing transaction into individual spending product transactions.
        Deletes the parent transaction in an atomic block so net balance remains exact.
        """
        parent_tx = self.get_object()
        items = request.data.get("items", [])

        if not items or not isinstance(items, list):
            return Response(
                {"error": "A list of 'items' is required to split the transaction."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_txs = []
        with db_transaction.atomic():
            for item in items:
                title = str(item.get("title") or item.get("name") or "Split Product").strip()[:200]
                amount_val = item.get("amount") or item.get("price")
                try:
                    amount = Decimal(str(amount_val))
                    if amount <= Decimal("0.00"):
                        continue
                except (TypeError, ValueError, InvalidOperation):
                    continue

                cat_id = item.get("category_id") or item.get("category") or getattr(parent_tx.category, "id", None)
                cat = Category.objects.filter(id=cat_id).first() if cat_id else parent_tx.category

                new_tx = Transaction.objects.create(
                    type=parent_tx.type,
                    title=title,
                    amount=amount,
                    category=cat,
                    payment_method=parent_tx.payment_method,
                    date=parent_tx.date,
                    description=item.get("notes") or f"Split product from {parent_tx.title}",
                )
                created_txs.append(new_tx)

            if not created_txs:
                return Response(
                    {"error": "No valid product items could be created."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Re-link any scan_tasks to the first child transaction
            for scan_task in parent_tx.scan_tasks.all():
                scan_task.transaction = created_txs[0]
                scan_task.save(update_fields=["transaction"])

            # Delete the parent transaction to maintain exact net balance
            parent_tx.delete()

        return Response(
            {
                "success": True,
                "message": f"Successfully split into {len(created_txs)} product transactions.",
                "created_transactions": TransactionSerializer(created_txs, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="split-bill")
    def split_bill(self, request):
        """
        Directly create multiple product transactions from a split bill without a pre-existing transaction.
        """
        items = request.data.get("items", [])
        tx_type = str(request.data.get("type", "DEBIT")).upper()
        payment_method = str(request.data.get("payment_method", "OTHER")).upper()
        tx_date = request.data.get("date") or timezone.localdate().isoformat()

        if not items or not isinstance(items, list):
            return Response(
                {"error": "A list of 'items' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_txs = []
        with db_transaction.atomic():
            for item in items:
                title = str(item.get("title") or item.get("name") or "Split Product").strip()[:200]
                amount_val = item.get("amount") or item.get("price")
                try:
                    amount = Decimal(str(amount_val))
                    if amount <= Decimal("0.00"):
                        continue
                except (TypeError, ValueError, InvalidOperation):
                    continue

                cat_id = item.get("category_id") or item.get("category")
                cat = Category.objects.filter(id=cat_id).first() if cat_id else None

                new_tx = Transaction.objects.create(
                    type=tx_type,
                    title=title,
                    amount=amount,
                    category=cat,
                    payment_method=payment_method,
                    date=tx_date,
                    description=item.get("notes") or "Created from split bill",
                )
                created_txs.append(new_tx)

        return Response(
            {
                "success": True,
                "message": f"Created {len(created_txs)} split product transactions.",
                "created_transactions": TransactionSerializer(created_txs, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


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
        qs = super().get_queryset().select_related("category").prefetch_related("scan_tasks")
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
    Accepts a multipart/form-data image, creates an async BillScanTask,
    spawns a background thread to process Gemini Vision & auto-update the balance,
    and returns HTTP 202 immediately to avoid client/gateway timeouts.
    """

    throttle_scope = "scan_bill"

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

        raw_bytes = image_file.read()

        # Create async task
        task = BillScanTask.objects.create(status=BillScanTask.Status.PROCESSING)

        # Spawn background processing thread
        thread = threading.Thread(
            target=process_bill_task_in_background,
            args=(str(task.id), raw_bytes),
            daemon=True,
        )
        thread.start()

        return Response(
            {
                "task_id": str(task.id),
                "status": task.status,
                "message": "Bill uploaded! Processing in background.",
            },
            status=status.HTTP_202_ACCEPTED,
        )


class BillScanStatusView(APIView):
    """
    GET /api/scan-bill/<uuid:task_id>/
    Polls the status of an asynchronous bill scan task and returns
    extracted data and auto-created transaction when completed.
    """

    def get(self, request, task_id):
        task = get_object_or_404(BillScanTask, id=task_id)

        tx_data = None
        if task.transaction:
            tx_data = TransactionSerializer(task.transaction).data

        return Response(
            {
                "task_id": str(task.id),
                "status": task.status,
                "error_message": task.error_message,
                "extracted_data": task.extracted_data,
                "transaction": tx_data,
                "created_at": task.created_at,
                "updated_at": task.updated_at,
            },
            status=status.HTTP_200_OK,
        )
