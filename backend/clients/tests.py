from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import ClientProfile, SupportTicket
from payments.models import PaymentMethod

User = get_user_model()


class ClientsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='c1', phone='+221770000020', password='pwd')

    def test_create_profile_and_add_payment(self):
        self.client.force_authenticate(user=self.user)
        # create profile
        resp = self.client.post('/api/clients/profile/', {}, format='json')
        self.assertEqual(resp.status_code, 201)
        profile = ClientProfile.objects.get(user=self.user)
        # add payment
        resp = self.client.post('/api/clients/payment-methods/', {'method': 'CASH', 'data': {}}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(PaymentMethod.objects.filter(client=profile).exists())

    def test_create_ticket(self):
        self.client.force_authenticate(user=self.user)
        self.client.post('/api/clients/profile/', {}, format='json')
        resp = self.client.post('/api/clients/tickets/', {'title': 'Issue', 'description': 'Problem'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(SupportTicket.objects.filter(client__user=self.user).exists())

    def test_admin_can_get_profiles_form_and_create(self):
        admin = User.objects.create_user(username='adm', phone='+221770000030', password='pwd')
        admin.is_staff = True
        admin.save()
        self.client.force_authenticate(user=admin)

        resp = self.client.get('/api/clients/profiles/', HTTP_ACCEPT='text/html')
        self.assertEqual(resp.status_code, 200)
        body = resp.content.decode()
        self.assertIn('POST /api/clients/profiles/', body)

        # create profile via admin endpoint
        other = User.objects.create_user(username='other', phone='+221770000031', password='pwd')
        resp = self.client.post('/api/clients/profiles/', {'user': other.id, 'language': 'wo'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(ClientProfile.objects.filter(user=other).exists())
