from django.contrib import admin
from .models import (
    Category,
    Transaction,
    SavingsGoal,
    SavingsDeposit,
    PeerDebt,
    DebtSettlement,
    AIReportCache,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "type", "is_default", "created_at")
    list_filter = ("type", "is_default")
    search_fields = ("name",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "title", "amount", "category", "date", "payment_method")
    list_filter = ("type", "payment_method", "date", "category")
    search_fields = ("title", "description")


class SavingsDepositInline(admin.TabularInline):
    model = SavingsDeposit
    extra = 1


@admin.register(SavingsGoal)
class SavingsGoalAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "current_amount", "target_amount", "target_date", "is_completed")
    list_filter = ("is_completed",)
    search_fields = ("title",)
    inlines = [SavingsDepositInline]


class DebtSettlementInline(admin.TabularInline):
    model = DebtSettlement
    extra = 1


@admin.register(PeerDebt)
class PeerDebtAdmin(admin.ModelAdmin):
    list_display = ("id", "person_name", "debt_type", "initial_amount", "remaining_amount", "status", "due_date")
    list_filter = ("debt_type", "status", "due_date")
    search_fields = ("person_name", "notes")
    inlines = [DebtSettlementInline]


@admin.register(AIReportCache)
class AIReportCacheAdmin(admin.ModelAdmin):
    list_display = ("id", "report_type", "period_start", "period_end", "data_hash", "generated_at")
    readonly_fields = ("generated_at",)

