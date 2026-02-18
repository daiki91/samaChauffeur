from django.test import TestCase
from rest_framework.test import APIClient
from .models import OTP
from django.contrib.auth import get_user_model

User = get_user_model()


class AuthOTPTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.phone = '+221770000001'

    def test_otp_send_and_verify_marks_user_verified(self):
        # register user first
        resp = self.client.post('/api/auth/register/', {'username': 'u1', 'phone': self.phone, 'password': 'pw1234', 'role': 'CLIENT'}, format='json')
        self.assertEqual(resp.status_code, 201)

        # send OTP
        resp = self.client.post('/api/auth/otp/send/', {'phone': self.phone}, format='json')
        self.assertEqual(resp.status_code, 200)

        # get OTP from DB
        otp = OTP.objects.filter(phone=self.phone).latest('created_at')
        self.assertIsNotNone(otp.code)

        # verify -> should NOT return tokens, only mark phone_verified
        resp = self.client.post('/api/auth/otp/verify/', {'phone': self.phone, 'code': otp.code}, format='json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertNotIn('access', data)
        self.assertNotIn('refresh', data)

        # user flagged as verified
        user = User.objects.get(phone=self.phone)
        self.assertTrue(user.phone_verified)

    def test_otp_send_uses_twilio_when_configured(self):
        from unittest.mock import patch
        # register user so OTPSend is allowed
        resp = self.client.post('/api/auth/register/', {'username': 'u2', 'phone': self.phone, 'password': 'pw1234', 'role': 'CLIENT'}, format='json')
        self.assertEqual(resp.status_code, 201)

        # configure TWILIO settings
        from django.conf import settings
        settings.TWILIO['ACCOUNT_SID'] = 'AC123'
        settings.TWILIO['AUTH_TOKEN'] = 'tok'
        settings.TWILIO['FROM_NUMBER'] = '+1234567890'

        with patch('accounts.sms.requests.post') as mock_post:
            mock_post.return_value.status_code = 201
            mock_post.return_value.json.return_value = {'sid': 'SMxxx'}

            resp = self.client.post('/api/auth/otp/send/', {'phone': self.phone}, format='json')
            self.assertEqual(resp.status_code, 200)
            self.assertTrue(mock_post.called)

    def test_register_endpoint_creates_user(self):
        resp = self.client.post('/api/auth/register/', {'username': 'toto', 'phone': '+221770000002', 'password': 'pass1234', 'role': 'CLIENT'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(phone='+221770000002').exists())

    def test_admin_can_create_user(self):
        admin = User.objects.create_user(username='adm', phone='+221770000010', password='pwd')
        admin.is_staff = True
        admin.save()
        self.client.force_authenticate(user=admin)
        resp = self.client.post('/api/auth/users/', {'username': 'new', 'phone': '+221770000011', 'password': 'pwd', 'role': 'CLIENT'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(phone='+221770000011').exists())

    def test_admin_gets_browsable_form(self):
        admin = User.objects.create_user(username='adm3', phone='+221770000030', password='pwd')
        admin.is_staff = True
        admin.save()
        self.client.force_authenticate(user=admin)

        resp = self.client.get('/api/auth/users/', HTTP_ACCEPT='text/html')
        self.assertEqual(resp.status_code, 200)
        body = resp.content.decode()
        # DRF browsable API should include a POST form area
        self.assertIn('POST /api/auth/users/', body)

    def test_non_admin_cannot_create_user(self):
        user = User.objects.create_user(username='u2', phone='+221770000012', password='pwd')
        self.client.force_authenticate(user=user)
        resp = self.client.post('/api/auth/users/', {'username': 'n', 'phone': '+221770000013', 'password': 'pwd', 'role': 'CLIENT'}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_register_cannot_create_admin(self):
        resp = self.client.post('/api/auth/register/', {'username': 'bad', 'phone': '+221770000005', 'password': 'pw', 'role': 'ADMIN'}, format='json')
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertIn('role', data)

    def test_register_create_chauffeur(self):
        resp = self.client.post('/api/auth/register/', {'username': 'driver', 'phone': '+221770000006', 'password': 'pw', 'role': 'CHAUFFEUR'}, format='json')
        self.assertEqual(resp.status_code, 201)
        user = User.objects.get(phone='+221770000006')
        self.assertEqual(user.role, 'CHAUFFEUR')

    def test_token_obtain_with_phone_and_password_returns_tokens(self):
        # create user
        user = User.objects.create_user(username='loginuser', phone='+221770000020', password='secretpw')
        # token obtain with phone + password
        resp = self.client.post('/api/auth/token/', {'phone': user.phone, 'password': 'secretpw'}, format='json')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('access', data)
        self.assertIn('refresh', data)

