from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .serializers import TripCreateSerializer, TripSerializer
from .models import Trip
from chauffeurs.models import Chauffeur
from django.db import transaction
import math
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from pricing.services import estimate_price


def haversine(lat1, lon1, lat2, lon2):
    # returns distance in kilometers
    R = 6371
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2*math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


class CreateTripView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = TripCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        trip = Trip.objects.create(
            passenger=request.user,
            origin=data.get('origin'),
            origin_lat=data.get('origin_lat'),
            origin_lng=data.get('origin_lng'),
            destination=data.get('destination'),
            dest_lat=data.get('dest_lat'),
            dest_lng=data.get('dest_lng'),
            mode=data.get('mode', 'PRIVATE')
        )

        # compute distance and price when coordinates available
        origin_lat = trip.origin_lat
        origin_lng = trip.origin_lng
        dest_lat = trip.dest_lat
        dest_lng = trip.dest_lng
        if origin_lat is not None and origin_lng is not None and dest_lat is not None and dest_lng is not None:
            dist = haversine(origin_lat, origin_lng, dest_lat, dest_lng)
            trip.distance_km = dist
            try:
                # estimate using default vehicle type CAR
                price = estimate_price(dist, 'CAR', trip.mode)
                # estimate_price returns dict like {'price': value, ...} or integer
                if isinstance(price, dict):
                    trip.price = price.get('price')
                else:
                    trip.price = price
            except Exception:
                # no pricing rule found; leave price as None
                pass
            trip.save()


class MyTripsList(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        trips = Trip.objects.filter(passenger=request.user).order_by('-created_at')
        serializer = TripSerializer(trips, many=True)
        return Response(serializer.data)


class AvailableTripsList(APIView):
    """Return list of unassigned trips (REQUESTED) for drivers to claim."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # only chauffeurs allowed
        user = request.user
        if not hasattr(user, 'chauffeur'):
            return Response({'detail': 'Not a chauffeur'}, status=status.HTTP_403_FORBIDDEN)
        qs = Trip.objects.filter(status='REQUESTED')
        serializer = TripSerializer(qs, many=True)
        return Response(serializer.data)


class ClaimTripView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        chauffeur = getattr(user, 'chauffeur', None)
        if not chauffeur:
            return Response({'detail': 'Not a chauffeur'}, status=status.HTTP_403_FORBIDDEN)
        try:
            trip = Trip.objects.get(pk=pk)
        except Trip.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if trip.status != 'REQUESTED' or trip.driver is not None:
            return Response({'detail': 'Trip not claimable'}, status=status.HTTP_400_BAD_REQUEST)
        trip.driver = chauffeur
        trip.status = 'ASSIGNED'
        trip.save()
        chauffeur.is_available = False
        chauffeur.save()
        # notify trip group and drivers
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        layer = get_channel_layer()
        async_to_sync(layer.group_send)('drivers', {'type': 'trip.assigned', 'trip_id': trip.id, 'driver_id': chauffeur.id})
        try:
            async_to_sync(layer.group_send)(f'trip_{trip.id}', {'type': 'trip.update', 'status': 'ASSIGNED', 'trip_id': trip.id})
        except Exception:
            pass
        return Response({'detail': 'Claimed', 'trip': TripSerializer(trip).data})

        # Attempt matching
        origin_lat = trip.origin_lat
        origin_lng = trip.origin_lng
        assigned_driver = None
        if origin_lat is not None and origin_lng is not None:
            candidates = Chauffeur.objects.filter(is_verified=True, is_available=True, latitude__isnull=False, longitude__isnull=False)
            best = None
            best_dist = None
            for c in candidates:
                dist = haversine(origin_lat, origin_lng, c.latitude, c.longitude)
                if best is None or dist < best_dist:
                    best = c
                    best_dist = dist

            if best:
                # assign
                trip.driver = best
                trip.status = 'ASSIGNED'
                trip.save()
                best.is_available = False
                best.save()
                assigned_driver = best

        out_ser = TripSerializer(trip)
        result = {'trip': out_ser.data}
        if assigned_driver:
            result['assigned_driver'] = {'id': assigned_driver.id, 'phone': assigned_driver.user.phone, 'distance_km': best_dist}
        else:
            # broadcast trip request to drivers group so connected drivers can see it
            layer = get_channel_layer()
            msg = {
                'type': 'trip.requested',
                'trip_id': trip.id,
                'origin': trip.origin,
                'destination': trip.destination,
                'distance_km': trip.distance_km,
                'price': trip.price,
            }
            try:
                async_to_sync(layer.group_send)('drivers', msg)
            except Exception:
                pass
            result['note'] = 'No nearby available driver, trip queued.'

        return Response(result, status=status.HTTP_201_CREATED)


class TripDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            trip = Trip.objects.get(pk=pk)
        except Trip.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TripSerializer(trip)
        return Response(serializer.data)


class AcceptTripView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        chauffeur = getattr(request.user, 'chauffeur', None)
        if not chauffeur:
            return Response({'detail': 'Not a chauffeur'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            trip = Trip.objects.get(pk=pk)
        except Trip.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        if trip.driver_id != chauffeur.id:
            return Response({'detail': 'Not assigned to you'}, status=status.HTTP_403_FORBIDDEN)

        if trip.status not in ('ASSIGNED', 'REQUESTED'):
            return Response({'detail': 'Cannot accept in current state'}, status=status.HTTP_400_BAD_REQUEST)

        trip.status = 'ACCEPTED'
        trip.save()
        return Response({'detail': 'Trip accepted'})


class RejectTripView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        chauffeur = getattr(request.user, 'chauffeur', None)
        if not chauffeur:
            return Response({'detail': 'Not a chauffeur'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            trip = Trip.objects.get(pk=pk)
        except Trip.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        if trip.driver_id != chauffeur.id:
            return Response({'detail': 'Not assigned to you'}, status=status.HTTP_403_FORBIDDEN)

        # unassign and mark available
        trip.driver = None
        trip.status = 'REQUESTED'
        trip.save()

        # mark driver available again
        chauffeur.is_available = True
        chauffeur.save()

        # try to reassign excluding this driver
        if trip.origin_lat is not None and trip.origin_lng is not None:
            candidates = Chauffeur.objects.filter(is_verified=True, is_available=True, latitude__isnull=False, longitude__isnull=False).exclude(id=chauffeur.id)
            best = None
            best_dist = None
            for c in candidates:
                dist = haversine(trip.origin_lat, trip.origin_lng, c.latitude, c.longitude)
                if best is None or dist < best_dist:
                    best = c
                    best_dist = dist
            if best:
                trip.driver = best
                trip.status = 'ASSIGNED'
                trip.save()
                best.is_available = False
                best.save()
                return Response({'detail': 'Trip reassigned', 'new_driver': best.id})

        return Response({'detail': 'Trip unassigned and queued'})


class StartTripView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        chauffeur = getattr(request.user, 'chauffeur', None)
        if not chauffeur:
            return Response({'detail': 'Not a chauffeur'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            trip = Trip.objects.get(pk=pk)
        except Trip.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        if trip.driver_id != chauffeur.id:
            return Response({'detail': 'Not assigned to you'}, status=status.HTTP_403_FORBIDDEN)

        if trip.status not in ('ACCEPTED', 'ASSIGNED'):
            return Response({'detail': 'Cannot start in current state'}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone
        trip.status = 'STARTED'
        trip.started_at = timezone.now()
        trip.save()
        return Response({'detail': 'Trip started'})


class EndTripView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        chauffeur = getattr(request.user, 'chauffeur', None)
        if not chauffeur:
            return Response({'detail': 'Not a chauffeur'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            trip = Trip.objects.get(pk=pk)
        except Trip.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        if trip.driver_id != chauffeur.id:
            return Response({'detail': 'Not assigned to you'}, status=status.HTTP_403_FORBIDDEN)

        if trip.status != 'STARTED':
            return Response({'detail': 'Cannot end trip not started'}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone
        trip.status = 'COMPLETED'
        trip.ended_at = timezone.now()
        trip.save()

        # free driver
        chauffeur.is_available = True
        chauffeur.save()

        return Response({'detail': 'Trip completed'})
