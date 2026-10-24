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
from .services.category_mapper_service import CategoryMapperService


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
    bill_data = serializers.SerializerMethodField(read_only=True)

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
            "bill_data",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "bill_data", "created_at", "updated_at"]
        extra_kwargs = {
            "category": {"required": False, "allow_null": True},
        }

    def get_bill_data(self, obj):
        task = obj.scan_tasks.filter(status="COMPLETED").first()
        if task and task.extracted_data:
            return {
                "task_id": str(task.id),
                "merchant": task.extracted_data.get("title"),
                "confidence": task.extracted_data.get("confidence", "high"),
                "line_items": task.extracted_data.get("line_items", []),
                "payment_method": task.extracted_data.get("payment_method"),
                "scanned_at": task.created_at.isoformat() if task.created_at else None,
            }
        return None

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def create(self, validated_data):
        # Auto-map category if omitted and title/description is available
        if not validated_data.get("category"):
            title = validated_data.get("title", "")
            description = validated_data.get("description", "")
            tx_type = validated_data.get("type", Transaction.TransactionType.DEBIT)

            try:
                suggestion = CategoryMapperService.suggest_category(
                    title=title,
                    description=description,
                    tx_type=tx_type,
                )
                if suggestion and suggestion.get("category_id"):
                    cat = Category.objects.filter(id=suggestion["category_id"]).first()
                    if cat:
                        validated_data["category"] = cat
            except Exception:
                pass

        return super().create(validated_data)


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

