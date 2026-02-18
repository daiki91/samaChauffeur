from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async



class DriverLocationConsumer(AsyncJsonWebsocketConsumer):
    async def trip_requested(self, event):
        # send trip request events to connected drivers
        await self.send_json({
            'type': 'trip.requested',
            'trip_id': event.get('trip_id'),
            'origin': event.get('origin'),
            'destination': event.get('destination'),
            'distance_km': event.get('distance_km'),
            'price': event.get('price'),
        })

    async def trip_assigned(self, event):
        await self.send_json({
            'type': 'trip.assigned',
            'trip_id': event.get('trip_id'),
            'driver_id': event.get('driver_id'),
        })
    """Simple WebSocket consumer for driver location updates.

    Expects JSON messages:
      {"type": "location.update", "driver_id": <id>, "lat": <float>, "lng": <float>}

    Broadcasts location updates to group 'drivers' (all admins/clients listening) and to 'driver_{id}'.
    """

    async def connect(self):
        # Allow only authenticated users who are verified chauffeurs
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4001)
            return

        # check chauffeur profile and verification
        from chauffeurs.models import Chauffeur
        try:
            chauffeur = await sync_to_async(lambda: user.chauffeur)()
        except Exception:
            await self.close(code=4003)
            return

        if not chauffeur.is_verified:
            await self.close(code=4004)
            return

        await self.accept()
        await self.channel_layer.group_add('drivers', self.channel_name)

    async def disconnect(self, code):
        await self.channel_layer.group_discard('drivers', self.channel_name)

    async def receive_json(self, content, **kwargs):
        event_type = content.get('type')
        if event_type == 'location.update':
            # allow driver to send its own location; prefer authenticated user->chauffeur mapping
            driver_id = content.get('driver_id')
            lat = content.get('lat')
            lng = content.get('lng')

            # if authenticated user has chauffeur, use that id
            user = self.scope.get('user')
            if hasattr(user, 'is_authenticated') and user.is_authenticated:
                try:
                    chauffeur = await sync_to_async(lambda: user.chauffeur)()
                    driver_id = chauffeur.id
                except Exception:
                    pass

            # persist location if possible
            if driver_id is not None and lat is not None and lng is not None:
                await self.save_location(driver_id, lat, lng)

            msg = {'type': 'broadcast.location', 'driver_id': driver_id, 'lat': lat, 'lng': lng}
            # broadcast to global drivers group
            await self.channel_layer.group_send('drivers', msg)
            # also notify driver-specific group
            if driver_id is not None:
                await self.channel_layer.group_send(f'driver_{driver_id}', msg)

    async def save_location(self, driver_id, lat, lng):
        from asgiref.sync import sync_to_async
        from chauffeurs.models import Chauffeur

        @sync_to_async
        def _save():
            try:
                c = Chauffeur.objects.get(id=driver_id)
                c.latitude = float(lat)
                c.longitude = float(lng)
                c.is_available = True
                c.save()
            except Chauffeur.DoesNotExist:
                pass

        await _save()

    async def broadcast_location(self, event):
        # send the event to websocket
        await self.send_json({
            'type': 'location.update',
            'driver_id': event.get('driver_id'),
            'lat': event.get('lat'),
            'lng': event.get('lng'),
        })


class DriversBroadcastConsumer(AsyncJsonWebsocketConsumer):
    """Consumer for clients to receive driver location broadcasts."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4001)
            return
        # allow clients and admins
        if not (getattr(user, 'role', None) == 'CLIENT' or getattr(user, 'is_staff', False) or getattr(user, 'role', None) == 'ADMIN'):
            await self.close(code=4003)
            return
        await self.accept()
        await self.channel_layer.group_add('drivers', self.channel_name)

    async def disconnect(self, code):
        await self.channel_layer.group_discard('drivers', self.channel_name)

    async def receive_json(self, content, **kwargs):
        # no client actions expected
        pass

    async def broadcast_location(self, event):
        await self.send_json({
            'type': 'broadcast.location',
            'driver_id': event.get('driver_id'),
            'lat': event.get('lat'),
            'lng': event.get('lng'),
        })

    async def trip_requested(self, event):
        await self.send_json({
            'type': 'trip.requested',
            'trip_id': event.get('trip_id'),
            'origin': event.get('origin'),
            'destination': event.get('destination'),
            'distance_km': event.get('distance_km'),
            'price': event.get('price'),
        })

    async def trip_assigned(self, event):
        await self.send_json({
            'type': 'trip.assigned',
            'trip_id': event.get('trip_id'),
            'driver_id': event.get('driver_id'),
        })


class TripNotificationConsumer(AsyncJsonWebsocketConsumer):
    """Client-side consumer: clients subscribe to trip notifications by trip id."""

    async def connect(self):
        # path contains trip id; allow only participant (passenger/driver) or admin
        trip_id = self.scope['url_route']['kwargs'].get('trip_id') if 'trip_id' in self.scope['url_route']['kwargs'] else None
        user = self.scope.get('user')

        if not trip_id:
            # No trip id supplied -> reject
            await self.close(code=4002)
            return

        # ensure authenticated
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4001)
            return

        from asgiref.sync import sync_to_async

        from courses.models import Trip

        @sync_to_async
        def _check():
            try:
                t = Trip.objects.get(id=trip_id)
            except Trip.DoesNotExist:
                return False
            # admin or owner or assigned driver
            if getattr(user, 'is_staff', False) or getattr(user, 'role', None) == 'ADMIN':
                return True
            if t.passenger_id == user.id:
                return True
            if t.driver and t.driver.user_id == user.id:
                return True
            return False

        allowed = await _check()
        if not allowed:
            await self.close(code=4003)
            return

        self.group_name = f'trip_{trip_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # No actions expected from clients for now
        pass

    async def trip_update(self, event):
        await self.send_json(event)
