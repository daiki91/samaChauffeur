from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from config.asgi import application
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from chauffeurs.models import Chauffeur

User = get_user_model()


class RealtimeTests(TransactionTestCase):
    async def test_driver_location_broadcast(self):
        # Create verified chauffeur user and token
        u = await sync_to_async(User.objects.create_user)(username='drv1', phone='+221770000300', password='pwd')
        ch = await sync_to_async(Chauffeur.objects.create)(user=u, is_verified=True, is_available=True, latitude=14.7, longitude=-17.45)
        from rest_framework_simplejwt.tokens import RefreshToken
        token = await sync_to_async(lambda: str(RefreshToken.for_user(u).access_token))()

        communicator = WebsocketCommunicator(application, f'/ws/realtime/driver/?token={token}')
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # send location update
        await communicator.send_json_to({'type': 'location.update', 'lat': 14.75, 'lng': -17.44})
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'location.update')
        self.assertEqual(response['driver_id'], ch.id)

        await communicator.disconnect()
