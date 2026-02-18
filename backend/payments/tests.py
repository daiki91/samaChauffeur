from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import Transaction

User = get_user_model()


class PaymentsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='u_pay', phone='+221770001000', password='pwd')

    def test_create_transaction(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/payments/transactions/', {'amount': 1000, 'currency': 'XOF', 'method': 'CASH'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Transaction.objects.filter(client__user=self.user).exists())
