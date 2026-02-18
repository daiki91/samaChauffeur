from accounts.permissions import IsClient
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .serializers import AdminChauffeurSerializer, VehicleSerializer, ChauffeurSerializer, ChauffeurAvailableSerializer
from .models import Vehicle, Chauffeur
from django.shortcuts import get_object_or_404
from accounts.permissions import IsAdmin, IsChauffeur


class ApplyChauffeurView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # user applies to become a chauffeur; admin will verify later
        user = request.user
        if hasattr(user, 'chauffeur'):
            return Response({'detail': 'Chauffeur profile already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        vehicle_data = request.data.get('vehicle')
        vehicle = None
        if vehicle_data:
            vs = VehicleSerializer(data=vehicle_data)
            vs.is_valid(raise_exception=True)
            vehicle = vs.save()

        chauffeur = Chauffeur.objects.create(user=user, vehicle=vehicle, is_verified=False, is_available=False)
        # set user role to CHAUFFEUR (unverified)
        user.role = 'CHAUFFEUR'
        user.save()

        serializer = ChauffeurSerializer(chauffeur)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


from rest_framework import generics


class VehicleListCreate(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer


class ChauffeurListCreate(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = Chauffeur.objects.all()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminChauffeurSerializer
        return ChauffeurSerializer


class AvailableChauffeursList(generics.ListAPIView):
    """List available, verified chauffeurs with their last known location.

    Optional query params: lat, lng, radius (km) to filter by proximity.
    """
    permission_classes = [permissions.IsAuthenticated, IsClient]
    serializer_class = ChauffeurAvailableSerializer

    def get_queryset(self):
        qs = Chauffeur.objects.filter(is_verified=True, is_available=True, latitude__isnull=False, longitude__isnull=False)
        lat = self.request.query_params.get('lat')
        lng = self.request.query_params.get('lng')
        radius = self.request.query_params.get('radius')
        if lat and lng and radius:
            try:
                lat = float(lat)
                lng = float(lng)
                radius_km = float(radius)
            except ValueError:
                return qs
            # approximate bounding box filter (1 degree ~111 km)
            delta = radius_km / 111.0
            return qs.filter(latitude__gte=lat - delta, latitude__lte=lat + delta,
                             longitude__gte=lng - delta, longitude__lte=lng + delta)
        return qs


class SetLocationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        if lat is None or lng is None:
            return Response({'detail': 'latitude and longitude required'}, status=status.HTTP_400_BAD_REQUEST)

        chauffeur = getattr(request.user, 'chauffeur', None)
        if not chauffeur:
            return Response({'detail': 'No chauffeur profile'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lat = float(lat)
            lng = float(lng)
        except ValueError:
            return Response({'detail': 'Invalid coordinates'}, status=status.HTTP_400_BAD_REQUEST)

        chauffeur.set_location(lat, lng)
        return Response({'detail': 'Location updated'})


class VerifyChauffeurView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        chauffeur = get_object_or_404(Chauffeur, pk=pk)
        chauffeur.is_verified = True
        chauffeur.save()
        return Response({'detail': 'Chauffeur verified.'})
