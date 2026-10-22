from decimal import Decimal
from django.db import models
from django.utils import timezone


class Category(models.Model):
    class CategoryType(models.TextChoices):
        EXPENSE = "EXPENSE", "Expense"
        INCOME = "INCOME", "Income"
        BOTH = "BOTH", "Both"

    name = models.CharField(max_length=50, unique=True)
    type = models.CharField(
        max_length=10,
        choices=CategoryType.choices,
        default=CategoryType.BOTH,
    )
    icon = models.CharField(max_length=50, blank=True, default="folder")
    color = models.CharField(max_length=20, blank=True, default="#4F46E5")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.type})"


class Transaction(models.Model):
    class TransactionType(models.TextChoices):
        DEBIT = "DEBIT", "Debit (Expense)"
        CREDIT = "CREDIT", "Credit (Income)"

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank Transfer"
        CREDIT_CARD = "CREDIT_CARD", "Credit Card"
        DEBIT_CARD = "DEBIT_CARD", "Debit Card"
        UPI = "UPI", "UPI"
        OTHER = "OTHER", "Other"

    type = models.CharField(
        max_length=10,
        choices=TransactionType.choices,
        default=TransactionType.DEBIT,
        db_index=True,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateField(default=timezone.localdate, db_index=True)
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.OTHER,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"[{self.type}] {self.title} - {self.amount}"


class SavingsGoal(models.Model):
    title = models.CharField(max_length=150)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    target_date = models.DateField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title}: {self.current_amount} / {self.target_amount}"

    @property
    def progress_percentage(self):
        if self.target_amount > 0:
            pct = (self.current_amount / self.target_amount) * 100
            return float(min(round(pct, 2), Decimal("100.00")))
        return 0.0


class SavingsDeposit(models.Model):
    goal = models.ForeignKey(
        SavingsGoal, on_delete=models.CASCADE, related_name="deposits"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField(default=timezone.localdate)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"Deposit of {self.amount} for {self.goal.title}"


class PeerDebt(models.Model):
    class DebtType(models.TextChoices):
        GIVEN = "GIVEN", "Amount given by me (They owe me)"
        BORROWED = "BORROWED", "Amount given to me (I owe them)"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PARTIALLY_SETTLED = "PARTIALLY_SETTLED", "Partially Settled"
        SETTLED = "SETTLED", "Settled"

    person_name = models.CharField(max_length=150, db_index=True)
    phone_or_contact = models.CharField(max_length=100, blank=True)
    debt_type = models.CharField(
        max_length=10,
        choices=DebtType.choices,
        default=DebtType.GIVEN,
        db_index=True,
    )
    initial_amount = models.DecimalField(max_digits=12, decimal_places=2)
    remaining_amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.debt_type} - {self.person_name}: {self.remaining_amount}/{self.initial_amount}"

    def save(self, *args, **kwargs):
        if self.remaining_amount is None:
            self.remaining_amount = self.initial_amount

        if self.remaining_amount <= Decimal("0.00"):
            self.remaining_amount = Decimal("0.00")
            self.status = self.Status.SETTLED
        elif self.remaining_amount < self.initial_amount:
            self.status = self.Status.PARTIALLY_SETTLED
        else:
            self.status = self.Status.PENDING

        super().save(*args, **kwargs)

    @property
    def settled_amount(self):
        return max(Decimal("0.00"), self.initial_amount - self.remaining_amount)

    @property
    def is_overdue(self):
        if self.due_date and self.status != self.Status.SETTLED:
            return self.due_date < timezone.now().date()
        return False

    @property
    def days_until_due(self):
        if self.due_date:
            delta = (self.due_date - timezone.now().date()).days
            return delta
        return None


class DebtSettlement(models.Model):
    peer_debt = models.ForeignKey(
        PeerDebt, on_delete=models.CASCADE, related_name="settlements"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    settled_at = models.DateField(default=timezone.localdate)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-settled_at", "-id"]

    def __str__(self):
        return f"Settlement of {self.amount} for {self.peer_debt.person_name}"


class AIReportCache(models.Model):
    report_type = models.CharField(max_length=50, default="financial_health")
    period_start = models.DateField()
    period_end = models.DateField()
    data_hash = models.CharField(max_length=64, db_index=True)
    content_json = models.JSONField(default=dict)
    content_markdown = models.TextField(blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return f"AI Report {self.period_start} to {self.period_end} ({self.generated_at})"
