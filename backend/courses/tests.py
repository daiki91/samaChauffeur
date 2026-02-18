from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from chauffeurs.models import Chauffeur

User = get_user_model()


class TripMatchingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # create two drivers
        self.d1 = User.objects.create_user(username='d1', phone='+221770000005', password='pwd')
        self.d2 = User.objects.create_user(username='d2', phone='+221770000006', password='pwd')
        self.ch1 = Chauffeur.objects.create(user=self.d1, is_verified=True, is_available=True, latitude=14.7, longitude=-17.45)
        self.ch2 = Chauffeur.objects.create(user=self.d2, is_verified=True, is_available=True, latitude=14.8, longitude=-17.4)
        # passenger
        self.p = User.objects.create_user(username='p1', phone='+221770000007', password='pwd')

    def test_create_trip_assigns_nearest_driver(self):
        self.client.force_authenticate(user=self.p)
        data = {
            'origin': 'Point A',
            'origin_lat': 14.75,
            'origin_lng': -17.44,
            'destination': 'Point B',
            'dest_lat': 15.0,
            'dest_lng': -17.0,
            'mode': 'PRIVATE',
        }
        resp = self.client.post('/api/trips/create/', data, format='json')
        self.assertEqual(resp.status_code, 201)
        j = resp.json()
        self.assertIn('trip', j)
        if 'assigned_driver' in j:
            self.assertIn('phone', j['assigned_driver'])
        else:
            self.fail('No driver assigned')

    def test_accept_and_complete_flow(self):
        # create trip and ensure assignment
        self.client.force_authenticate(user=self.p)
        data = {
            'origin': 'Point A',
            'origin_lat': 14.75,
            'origin_lng': -17.44,
            'destination': 'Point B',
            'dest_lat': 15.0,
            'dest_lng': -17.0,
            'mode': 'PRIVATE',
        }
        resp = self.client.post('/api/trips/create/', data, format='json')
        self.assertEqual(resp.status_code, 201)
        j = resp.json()
        trip_id = j['trip']['id']
        self.assertIn('assigned_driver', j)
        driver_phone = j['assigned_driver']['phone']

        # find driver user
        driver_user = User.objects.get(phone=driver_phone)
        self.client.force_authenticate(user=driver_user)
        # accept
        resp = self.client.post(f'/api/trips/{trip_id}/accept/')
        self.assertEqual(resp.status_code, 200)
        # start
        resp = self.client.post(f'/api/trips/{trip_id}/start/')
        self.assertEqual(resp.status_code, 200)
        # end
        resp = self.client.post(f'/api/trips/{trip_id}/end/')
        self.assertEqual(resp.status_code, 200)

        # set a price and make a payment as client
        from django.shortcuts import get_object_or_404
        from payments.models import Transaction
        from clients.models import ClientProfile

        trip = get_object_or_404(Trip, pk=trip_id)
        trip.price = 1500
        trip.save()

        # create client profile
        ClientProfile.objects.create(user=self.p)
        self.client.force_authenticate(user=self.p)
        pay_resp = self.client.post('/api/payments/transactions/', {'amount': 1500, 'currency': 'XOF', 'method': 'CASH', 'status': 'COMPLETED', 'metadata': {'trip_id': trip_id}}, format='json')
        self.assertEqual(pay_resp.status_code, 201)
        self.assertTrue(Transaction.objects.filter(client=self.p.clientprofile, amount=1500).exists())
