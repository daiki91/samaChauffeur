from django.test import TestCase
from rest_framework.test import APIClient
from .models import PricingRule


class PricingTests(TestCase):
    def setUp(self):
        # create some pricing rules
        PricingRule.objects.create(vehicle_type='CAR', mode='PRIVATE', region=None, price_per_km=100)
        PricingRule.objects.create(vehicle_type='CAR', mode='SHARED', region=None, price_per_km=70)
        PricingRule.objects.create(vehicle_type='MINIBUS', mode='BUS', region='Dakar', price_per_km=50)
        self.client = APIClient()

    def test_find_price_per_km_and_estimate(self):
        # estimate using car private
        resp = self.client.post('/api/pricing/estimate/', {'distance_km': 10.5, 'vehicle_type': 'CAR', 'mode': 'PRIVATE'}, format='json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(float(data['price_per_km']), 100.00)
        self.assertAlmostEqual(float(data['price']), 1050.00, places=2)

    def test_estimate_no_rule(self):
        resp = self.client.post('/api/pricing/estimate/', {'distance_km': 5, 'vehicle_type': 'BUS', 'mode': 'PRIVATE'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('detail', resp.json())

    def test_rules_list_requires_auth(self):
        # list rules requires auth but we allow any authenticated (we set IsAuthenticated). Unauthenticated returns 401.
        resp = self.client.get('/api/pricing/rules/')
        self.assertEqual(resp.status_code, 401)
