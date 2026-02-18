from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from clients.models import ClientProfile
from gares.models import Line
from .models import Ticket

User = get_user_model()


class TicketsDetailedTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='pass', phone='+221770007000', password='pwd')
        self.profile = ClientProfile.objects.create(user=self.user)
        s1 = Line.objects.create(name='L1', origin_id=1, destination_id=1)
        self.line = s1

    def test_create_ticket_attaches_passenger(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/tickets/', {'line': self.line.id, 'price': 250}, format='json')
        self.assertEqual(resp.status_code, 201)
        t = Ticket.objects.get(id=resp.json()['id'])
        self.assertEqual(t.passenger, self.profile)

    def test_ticket_detail_restricted(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/tickets/', {'line': self.line.id, 'price': 100}, format='json')
        self.assertEqual(resp.status_code, 201)
        ticket_id = resp.json()['id']

        other = User.objects.create_user(username='otherp', phone='+221770007001', password='pwd')
        self.client.force_authenticate(user=other)
        resp = self.client.get(f'/api/tickets/{ticket_id}/')
        self.assertEqual(resp.status_code, 403)

        # admin can access
        admin = User.objects.create_user(username='admint', phone='+221770007002', password='pwd')
        admin.is_staff = True
        admin.save()
        self.client.force_authenticate(user=admin)
        resp = self.client.get(f'/api/tickets/{ticket_id}/')
        self.assertEqual(resp.status_code, 200)
