from rest_framework import generics, permissions
from .models import Station, Line, Schedule
from .serializers import StationSerializer, LineSerializer, ScheduleSerializer
from accounts.permissions import IsAdmin


class StationListCreate(generics.ListCreateAPIView):
    # Public GET, admin-only POST
    queryset = Station.objects.all()
    serializer_class = StationSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.AllowAny()]


class StationDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Station.objects.all()
    serializer_class = StationSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.AllowAny()]


class LineListCreate(generics.ListCreateAPIView):
    queryset = Line.objects.all()
    serializer_class = LineSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.AllowAny()]


class LineDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Line.objects.all()
    serializer_class = LineSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.AllowAny()]


class ScheduleListCreate(generics.ListCreateAPIView):
    queryset = Schedule.objects.all()
    serializer_class = ScheduleSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.AllowAny()]


class ScheduleDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Schedule.objects.all()
    serializer_class = ScheduleSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.AllowAny()]
