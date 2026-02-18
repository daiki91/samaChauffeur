from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from .models import Station, Line

User = get_user_model()


class GaresTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='gadmin', phone='+221770006000', password='pwd')
        self.admin.is_staff = True
        self.admin.save()

    def test_admin_can_create_station_and_list_public(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post('/api/gares/stations/', {'name': 'Gare 1', 'city': 'Dakar'}, format='json')
        self.assertEqual(resp.status_code, 201)

        # unauthenticated can list stations
        self.client.force_authenticate(user=None)
        resp = self.client.get('/api/gares/stations/')
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.json()), 1)

    def test_admin_create_line_and_schedule(self):
        self.client.force_authenticate(user=self.admin)
        s1 = Station.objects.create(name='A', city='X')
        s2 = Station.objects.create(name='B', city='Y')
        resp = self.client.post('/api/gares/lines/', {'name': 'L1', 'origin': s1.id, 'destination': s2.id}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Line.objects.filter(name='L1').exists())
