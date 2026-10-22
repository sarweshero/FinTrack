from rest_framework import status
from rest_framework.test import APITestCase
from core.finance.models import Category


class CategoryAPITests(APITestCase):
    def setUp(self):
        self.cat1 = Category.objects.create(
            name="Fitness",
            type=Category.CategoryType.EXPENSE,
            icon="activity",
            color="#10B981",
        )
        self.cat2 = Category.objects.create(
            name="Investments",
            type=Category.CategoryType.INCOME,
            icon="trending-up",
            color="#6366F1",
        )

    def test_list_categories(self):
        response = self.client.get("/api/categories/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [c["name"] for c in response.data]
        self.assertIn("Fitness", names)
        self.assertIn("Investments", names)

    def test_filter_categories_by_type(self):
        response = self.client.get("/api/categories/?type=EXPENSE")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for cat in response.data:
            self.assertIn(cat["type"], ["EXPENSE", "BOTH"])

    def test_create_category(self):
        payload = {
            "name": "Subscriptions",
            "type": "EXPENSE",
            "icon": "tv",
            "color": "#8B5CF6",
        }
        response = self.client.post("/api/categories/", payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Subscriptions")
        self.assertTrue(Category.objects.filter(name="Subscriptions").exists())

    def test_update_category(self):
        payload = {"name": "Health & Fitness", "type": "EXPENSE"}
        response = self.client.patch(f"/api/categories/{self.cat1.id}/", payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cat1.refresh_from_db()
        self.assertEqual(self.cat1.name, "Health & Fitness")

    def test_delete_category(self):
        response = self.client.delete(f"/api/categories/{self.cat2.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=self.cat2.id).exists())

