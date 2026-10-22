from decimal import Decimal
from rest_framework import serializers
from .models import (
    Category,
    Transaction,
    SavingsGoal,
    SavingsDeposit,
    PeerDebt,
    DebtSettlement,
    AIReportCache,
)


class CategorySerializer(serializers.ModelSerializer):
    transaction_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "type",
            "icon",
            "color",
            "is_default",
            "transaction_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_transaction_count(self, obj):
        return obj.transactions.count()


class TransactionSerializer(serializers.ModelSerializer):
    category_details = CategorySerializer(source="category", read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "type",
            "amount",
            "category",
            "category_details",
            "title",
            "description",
            "date",
            "payment_method",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "category": {"required": False, "allow_null": True},
        }

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class DebitTransactionSerializer(TransactionSerializer):
    """Enforces type=DEBIT for the /api/debit/ endpoint."""

    def create(self, validated_data):
        validated_data["type"] = Transaction.TransactionType.DEBIT
        return super().create(validated_data)


class CreditTransactionSerializer(TransactionSerializer):
    """Enforces type=CREDIT for the /api/credit/ endpoint."""

    def create(self, validated_data):
        validated_data["type"] = Transaction.TransactionType.CREDIT
        return super().create(validated_data)


class SavingsDepositSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingsDeposit
        fields = ["id", "goal", "amount", "date", "notes", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Deposit amount must be greater than zero.")
        return value


class SavingsGoalSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.ReadOnlyField()
    deposits = SavingsDepositSerializer(many=True, read_only=True)

    class Meta:
        model = SavingsGoal
        fields = [
            "id",
            "title",
            "target_amount",
            "current_amount",
            "progress_percentage",
            "target_date",
            "is_completed",
            "deposits",
            "created_at",
        ]
        read_only_fields = ["id", "progress_percentage", "created_at"]

    def validate_target_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Target amount must be greater than zero.")
        return value


class DepositActionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True)
    date = serializers.DateField(required=False)

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Deposit amount must be greater than zero.")
        return value


class DebtSettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = DebtSettlement
        fields = ["id", "peer_debt", "amount", "settled_at", "notes", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Settlement amount must be greater than zero.")
        return value


class PeerDebtSerializer(serializers.ModelSerializer):
    settled_amount = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()
    days_until_due = serializers.ReadOnlyField()
    settlements = DebtSettlementSerializer(many=True, read_only=True)

    class Meta:
        model = PeerDebt
        fields = [
            "id",
            "person_name",
            "phone_or_contact",
            "debt_type",
            "initial_amount",
            "remaining_amount",
            "settled_amount",
            "due_date",
            "days_until_due",
            "is_overdue",
            "status",
            "notes",
            "settlements",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "remaining_amount",
            "settled_amount",
            "days_until_due",
            "is_overdue",
            "status",
            "created_at",
        ]

    def validate_initial_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Initial amount must be greater than zero.")
        return value

    def create(self, validated_data):
        if "remaining_amount" not in validated_data:
            validated_data["remaining_amount"] = validated_data["initial_amount"]
        return super().create(validated_data)


class DebtSettleActionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True)
    settled_at = serializers.DateField(required=False)

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value


class AIReportSerializer(serializers.Serializer):
    source = serializers.CharField()
    generated_at = serializers.DateTimeField()
    content_json = serializers.DictField()
    content_markdown = serializers.CharField()

