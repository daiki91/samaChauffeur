from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings
from config.asgi import application
from django.contrib.auth import get_user_model
from chauffeurs.models import Chauffeur
from asgiref.sync import sync_to_async
from rest_framework_simplejwt.tokens import RefreshToken
from courses.models import Trip

User = get_user_model()


@override_settings(CHANNEL_LAYERS={
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer'
    }
})
class RealtimeAuthTests(TransactionTestCase):
    async def test_driver_socket_requires_verified_chauffeur(self):
        # user without chauffeur
        u = await sync_to_async(User.objects.create_user)(username='u1', phone='+221770000200', password='pwd')
        communicator = WebsocketCommunicator(application, '/ws/realtime/driver/?token=invalid')
        connected, _ = await communicator.connect()
        # invalid token => no connect
        self.assertFalse(connected)

        # create unverified chauffeur
        u2 = await sync_to_async(User.objects.create_user)(username='u2', phone='+221770000201', password='pwd')
        ch = await sync_to_async(Chauffeur.objects.create)(user=u2, is_verified=False)
        token = await sync_to_async(lambda: str(RefreshToken.for_user(u2).access_token))()
        communicator = WebsocketCommunicator(application, f'/ws/realtime/driver/?token={token}')
        connected, _ = await communicator.connect()
        self.assertFalse(connected)

        # create verified chauffeur
        ch.is_verified = True
        await sync_to_async(ch.save)()
        communicator = WebsocketCommunicator(application, f'/ws/realtime/driver/?token={token}')
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_trip_socket_restricted_to_participants(self):
        p = await sync_to_async(User.objects.create_user)(username='pass', phone='+221770000202', password='pwd')
        d = await sync_to_async(User.objects.create_user)(username='drv', phone='+221770000203', password='pwd')
        ch = await sync_to_async(Chauffeur.objects.create)(user=d, is_verified=True, is_available=True)

        trip = await sync_to_async(Trip.objects.create)(passenger=p, origin='A', destination='B')

        # other user should not connect
        other = await sync_to_async(User.objects.create_user)(username='other', phone='+221770000204', password='pwd')
        token_other = await sync_to_async(lambda: str(RefreshToken.for_user(other).access_token))()
        communicator = WebsocketCommunicator(application, f'/ws/realtime/trip/{trip.id}/?token={token_other}')
        connected, _ = await communicator.connect()
        self.assertFalse(connected)

        # passenger can connect
        token_p = await sync_to_async(lambda: str(RefreshToken.for_user(p).access_token))()
        communicator = WebsocketCommunicator(application, f'/ws/realtime/trip/{trip.id}/?token={token_p}')
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()
