from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import Transaction, PaymentMethod
from clients.models import ClientProfile

User = get_user_model()


class PaymentsDetailedTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='payer', phone='+221770005000', password='pwd')
        # create client profile
        self.profile = ClientProfile.objects.create(user=self.user)

    def test_create_transaction_attached_to_client(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/payments/transactions/', {'amount': 500, 'currency': 'XOF', 'method': 'CASH'}, format='json')
        self.assertEqual(resp.status_code, 201)
        t = Transaction.objects.get(id=resp.json()['id'])
        self.assertEqual(t.client, self.profile)

    def test_payment_method_default_unsets_others(self):
        self.client.force_authenticate(user=self.user)
        resp1 = self.client.post('/api/payments/methods/', {'provider': 'ORANGE', 'details': {}}, format='json')
        self.assertEqual(resp1.status_code, 201)
        resp2 = self.client.post('/api/payments/methods/', {'provider': 'WAVE', 'details': {}, 'is_default': True}, format='json')
        self.assertEqual(resp2.status_code, 201)
        self.assertFalse(PaymentMethod.objects.get(id=resp1.json()['id']).is_default)
        self.assertTrue(PaymentMethod.objects.get(id=resp2.json()['id']).is_default)

    def test_transaction_list_restricted_to_client(self):
        other = User.objects.create_user(username='other', phone='+221770005001', password='pwd')
        other_profile = ClientProfile.objects.create(user=other)
        Transaction.objects.create(client=other_profile, amount=100, currency='XOF', method='CASH')

        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/payments/transactions/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 0)

        # admin can see all
        admin = User.objects.create_user(username='adminp', phone='+221770005002', password='pwd')
        admin.is_staff = True
        admin.save()
        self.client.force_authenticate(user=admin)
        resp = self.client.get('/api/payments/transactions/')
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.json()), 1)
