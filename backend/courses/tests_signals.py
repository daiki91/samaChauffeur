from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings
from config.asgi import application
from .models import Trip
from django.contrib.auth import get_user_model
from chauffeurs.models import Chauffeur
from asgiref.sync import sync_to_async
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@override_settings(CHANNEL_LAYERS={
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer'
    }
})
class TripSignalsTests(TransactionTestCase):
    async def test_trip_status_change_emits_notification(self):
        # create driver and passenger (use sync_to_async inside async test)
        p = await sync_to_async(User.objects.create_user)(username='p', phone='+221770000100', password='pwd')
        d = await sync_to_async(User.objects.create_user)(username='d', phone='+221770000101', password='pwd')
        ch = await sync_to_async(Chauffeur.objects.create)(user=d, is_verified=True, is_available=True, latitude=14.7, longitude=-17.45)

        trip = await sync_to_async(Trip.objects.create)(passenger=p, origin='A', destination='B')

        # connect to trip websocket (as passenger)
        token_p = await sync_to_async(lambda: str(RefreshToken.for_user(p).access_token))()
        communicator = WebsocketCommunicator(application, f"/ws/realtime/trip/{trip.id}/?token={token_p}")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # change trip status to ASSIGNED and set driver
        trip.driver = ch
        trip.status = 'ASSIGNED'
        await sync_to_async(trip.save)()

        msg = await communicator.receive_json_from()
        self.assertEqual(msg.get('type'), 'trip_update')
        self.assertEqual(msg.get('status'), 'ASSIGNED')

        await communicator.disconnect()
