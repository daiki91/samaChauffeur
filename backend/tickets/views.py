from rest_framework import generics, permissions
from .models import Ticket
from .serializers import TicketSerializer
from accounts.permissions import IsAdmin


class TicketListCreate(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'clientprofile'):
            return Ticket.objects.filter(passenger=user.clientprofile)
        return Ticket.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        client = getattr(user, 'clientprofile', None)
        serializer.save(passenger=client)


class TicketDetail(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if not (getattr(user, 'is_staff', False) or getattr(user, 'role', None) == 'ADMIN'):
            if not hasattr(user, 'clientprofile') or obj.passenger_id != user.clientprofile.id:
                self.permission_denied(self.request)
        return obj


class AdminTicketListCreate(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
