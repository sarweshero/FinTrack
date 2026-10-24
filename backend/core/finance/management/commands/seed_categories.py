from django.core.management.base import BaseCommand
from core.finance.models import Category

DEFAULT_CATEGORIES = [
    # Expenses
    {"name": "Food & Dining", "type": "EXPENSE", "icon": "utensils", "color": "#EF4444", "is_default": True},
    {"name": "Groceries", "type": "EXPENSE", "icon": "shopping-cart", "color": "#10B981", "is_default": True},
    {"name": "Rent & Housing", "type": "EXPENSE", "icon": "home", "color": "#F59E0B", "is_default": True},
    {"name": "Utilities & Bills", "type": "EXPENSE", "icon": "zap", "color": "#3B82F6", "is_default": True},
    {"name": "Entertainment", "type": "EXPENSE", "icon": "film", "color": "#8B5CF6", "is_default": True},
    {"name": "Shopping", "type": "EXPENSE", "icon": "tag", "color": "#EC4899", "is_default": True},
    {"name": "Fuel & Travel", "type": "EXPENSE", "icon": "car", "color": "#F97316", "is_default": True},
    {"name": "Healthcare & Medical", "type": "EXPENSE", "icon": "heart-pulse", "color": "#14B8A6", "is_default": True},
    {"name": "Education & Learning", "type": "EXPENSE", "icon": "graduation-cap", "color": "#0284C7", "is_default": True},

    # Income
    {"name": "Salary", "type": "INCOME", "icon": "briefcase", "color": "#059669", "is_default": True},
    {"name": "Freelance & Consulting", "type": "INCOME", "icon": "laptop", "color": "#0D9488", "is_default": True},
    {"name": "Investments & Dividends", "type": "INCOME", "icon": "trending-up", "color": "#6366F1", "is_default": True},
    {"name": "Gifts & Grants", "type": "INCOME", "icon": "gift", "color": "#E11D48", "is_default": True},

    # Both
    {"name": "General & Other", "type": "BOTH", "icon": "folder", "color": "#6B7280", "is_default": True},
]

class Command(BaseCommand):
    help = "Seed standard default categories for FinPulse"

    def handle(self, *args, **options):
        created_count = 0
        existing_count = 0

        for cat_data in DEFAULT_CATEGORIES:
            name = cat_data["name"]
            category, created = Category.objects.get_or_create(
                name=name,
                defaults={
                    "type": cat_data["type"],
                    "icon": cat_data["icon"],
                    "color": cat_data["color"],
                    "is_default": cat_data["is_default"],
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  + Created: {name} ({cat_data['type']})"))
            else:
                existing_count += 1
                self.stdout.write(f"  = Exists: {name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSeeding complete! {created_count} added, {existing_count} already existed. Total: {Category.objects.count()} categories."
            )
        )

