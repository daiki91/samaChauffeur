from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import Chauffeur, Vehicle

User = get_user_model()


class ChauffeurFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='u1', phone='+221770000003', password='pwd')
        self.admin = User.objects.create_user(username='admin', phone='+221770000004', password='pwd')
        self.admin.is_staff = True
        self.admin.save()

    def test_apply_become_chauffeur_and_admin_verify(self):
        self.client.force_authenticate(user=self.user)
        vehicle = {'type': 'CAR', 'seats': 4, 'plate_number': 'ABC-123'}
        resp = self.client.post('/api/chauffeurs/apply/', {'vehicle': vehicle}, format='json')
        self.assertEqual(resp.status_code, 201)
        ch = Chauffeur.objects.get(user=self.user)
        self.assertFalse(ch.is_verified)

        # admin verifies
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f'/api/chauffeurs/verify/{ch.id}/')
        self.assertEqual(resp.status_code, 200)
        ch.refresh_from_db()
        self.assertTrue(ch.is_verified)

    def test_set_location_requires_chauffeur(self):
        # not chauffeur
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/chauffeurs/location/', {'latitude': 14.7, 'longitude': -17.5}, format='json')
        self.assertEqual(resp.status_code, 400)

        # create chauffeur
        ch = Chauffeur.objects.create(user=self.user, is_verified=True, is_available=True)
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/chauffeurs/location/', {'latitude': 14.7, 'longitude': -17.5}, format='json')
        self.assertEqual(resp.status_code, 200)
        ch.refresh_from_db()
        self.assertIsNotNone(ch.latitude)
        self.assertIsNotNone(ch.longitude)

    def test_admin_gets_vehicle_form_and_create_vehicle(self):
        self.client.force_authenticate(user=self.admin)

        resp = self.client.get('/api/chauffeurs/vehicles/', HTTP_ACCEPT='text/html')
        self.assertEqual(resp.status_code, 200)
        body = resp.content.decode()
        self.assertIn('POST /api/chauffeurs/vehicles/', body)

        resp = self.client.post('/api/chauffeurs/vehicles/', {'type': 'SUV', 'seats': 5, 'plate_number': 'XYZ-999'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Vehicle.objects.filter(plate_number='XYZ-999').exists())

    def test_admin_gets_chauffeur_form_and_create(self):
        self.client.force_authenticate(user=self.admin)

        resp = self.client.get('/api/chauffeurs/admin/chauffeurs/', HTTP_ACCEPT='text/html')
        self.assertEqual(resp.status_code, 200)
        body = resp.content.decode()
        self.assertIn('POST /api/chauffeurs/admin/chauffeurs/', body)

        # create vehicle and user first
        v = Vehicle.objects.create(type='CAR', seats=4, plate_number='CREATE-1')
        user = User.objects.create_user(username='drv', phone='+221770000042', password='pwd')
        resp = self.client.post('/api/chauffeurs/admin/chauffeurs/', {'user': user.id, 'vehicle': v.id, 'is_verified': True}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Chauffeur.objects.filter(user=user).exists())

    def test_client_sees_available_chauffeurs_and_radius_filter(self):
        # create client and authenticate
        client_user = User.objects.create_user(username='client', phone='+221770000050', password='pwd')
        self.client.force_authenticate(user=client_user)

        # create various chauffeurs
        drv1 = User.objects.create_user(username='drv1', phone='+221770000051', password='pwd')
        ch1 = Chauffeur.objects.create(user=drv1, is_verified=True, is_available=True, latitude=14.7, longitude=-17.5)

        drv2 = User.objects.create_user(username='drv2', phone='+221770000052', password='pwd')
        ch2 = Chauffeur.objects.create(user=drv2, is_verified=True, is_available=False, latitude=14.8, longitude=-17.6)

        drv3 = User.objects.create_user(username='drv3', phone='+221770000053', password='pwd')
        ch3 = Chauffeur.objects.create(user=drv3, is_verified=True, is_available=True, latitude=None, longitude=None)

        # list available chauffeurs
        resp = self.client.get('/api/chauffeurs/available/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIsInstance(data, list)
        # only ch1 should be returned (verified, available, has location)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['phone'], '+221770000051')

        # radius filter: only include within 1 km of 14.7,-17.5 (should include ch1)
        resp = self.client.get('/api/chauffeurs/available/?lat=14.7&lng=-17.5&radius=1')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)

    def test_payments_summary_for_client(self):
        # create client and transactions
        client_user = User.objects.create_user(username='client2', phone='+221770000060', password='pwd')
        from payments.models import Transaction
        # create a ClientProfile for user
        from clients.models import ClientProfile
        cp = ClientProfile.objects.create(user=client_user)
        Transaction.objects.create(client=cp, amount=1000, currency='XOF', status='COMPLETED')
        Transaction.objects.create(client=cp, amount=2500, currency='XOF', status='PENDING')

        self.client.force_authenticate(user=client_user)
        resp = self.client.get('/api/payments/summary/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['total_spent'], 1000)
        self.assertTrue(isinstance(data['recent_transactions'], list))
