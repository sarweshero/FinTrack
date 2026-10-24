from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    DebitViewSet,
    CreditViewSet,
    TransactionViewSet,
    SavingsGoalViewSet,
    PeerDebtViewSet,
    RemindersView,
    DashboardSummaryView,
    DashboardTrendsView,
    DashboardCategoriesView,
    DashboardWhoOwesView,
    AIReportView,
    BillScanView,
    BillScanStatusView,
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"debit", DebitViewSet, basename="debit")
router.register(r"credit", CreditViewSet, basename="credit")
router.register(r"transactions", TransactionViewSet, basename="transaction")
router.register(r"savings", SavingsGoalViewSet, basename="savings")
router.register(r"debts", PeerDebtViewSet, basename="debt")

urlpatterns = [
    # Dedicated Reminders page route
    path("reminders/", RemindersView.as_view(), name="reminders-page"),
    # Dashboard analytics routes
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("dashboard/trends/", DashboardTrendsView.as_view(), name="dashboard-trends"),
    path("dashboard/categories/", DashboardCategoriesView.as_view(), name="dashboard-categories"),
    path("dashboard/who-owes/", DashboardWhoOwesView.as_view(), name="dashboard-who-owes"),
    # AI Financial Report route
    path("ai-report/", AIReportView.as_view(), name="ai-report"),
    # Bill / Receipt Scanner (Gemini Vision) — async quota-safe
    path("scan-bill/", BillScanView.as_view(), name="scan-bill"),
    path("scan-bill/<uuid:task_id>/", BillScanStatusView.as_view(), name="scan-bill-status"),
    # Router endpoints
    path("", include(router.urls)),
]

