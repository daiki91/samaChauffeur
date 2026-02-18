from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import Transaction, PaymentMethod, Payout
from .serializers import TransactionSerializer, PaymentMethodSerializer, PayoutSerializer
from accounts.permissions import IsAdmin
from django.db import models
from rest_framework.views import APIView


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if getattr(user, 'is_staff', False) or getattr(user, 'role', None) == 'ADMIN':
            return True
        # Transaction.client is a ClientProfile
        return hasattr(user, 'clientprofile') and obj.client_id == user.clientprofile.id


class TransactionListCreate(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'is_staff', False) or getattr(user, 'role', None) == 'ADMIN':
            return Transaction.objects.all()
        # restrict to current client's transactions
        if hasattr(user, 'clientprofile'):
            return Transaction.objects.filter(client=user.clientprofile)
        return Transaction.objects.none()

    def perform_create(self, serializer):
        from clients.models import ClientProfile
        user = self.request.user
        profile = getattr(user, 'clientprofile', None)
        # auto-create client profile if missing (improve UX)
        if profile is None:
            profile = ClientProfile.objects.create(user=user)
        # force status to PENDING regardless of client-provided value
        serializer.save(client=profile, status='PENDING')


class TransactionDetail(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    lookup_field = 'pk'


class PaymentMethodListCreate(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'clientprofile'):
            return PaymentMethod.objects.filter(client=user.clientprofile)
        return PaymentMethod.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        profile = getattr(user, 'clientprofile', None)
        pm = serializer.save(client=profile)
        if pm.is_default and profile:
            profile.payment_methods.exclude(id=pm.id).update(is_default=False)


class PaymentMethodDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if not (getattr(user, 'is_staff', False) or getattr(user, 'role', None) == 'ADMIN'):
            if not hasattr(user, 'clientprofile') or obj.client_id != user.clientprofile.id:
                self.permission_denied(self.request)
        return obj


class PayoutListCreate(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = Payout.objects.all()
    serializer_class = PayoutSerializer


class ValidateTransaction(APIView):
    """Allow a driver (owner of the trip) to validate a pending payment."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            t = Transaction.objects.get(pk=pk)
        except Transaction.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # transaction must be pending
        if t.status != 'PENDING':
            return Response({'detail': 'Transaction not pending'}, status=status.HTTP_400_BAD_REQUEST)

        # driver must be owner of the trip referenced in metadata
        trip_id = (t.metadata or {}).get('trip_id')
        if not trip_id:
            return Response({'detail': 'No trip associated'}, status=status.HTTP_400_BAD_REQUEST)

        from courses.models import Trip
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({'detail': 'Trip not found'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if not hasattr(user, 'chauffeur') or trip.driver_id != user.chauffeur.id:
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        # mark completed
        t.status = 'COMPLETED'
        t.save()
        return Response(TransactionSerializer(t).data)


class PendingTransactionsForDriver(APIView):
    """List pending transactions related to trips assigned to the authenticated driver."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'chauffeur'):
            return Response({'detail': 'Not a chauffeur'}, status=status.HTTP_403_FORBIDDEN)
        driver = user.chauffeur
        # find trips assigned to this driver
        from courses.models import Trip
        trips = Trip.objects.filter(driver=driver)
        trip_ids = list(trips.values_list('id', flat=True))
        qs = Transaction.objects.filter(status='PENDING', metadata__trip_id__in=trip_ids)
        serializer = TransactionSerializer(qs, many=True)
        return Response(serializer.data)


from rest_framework.views import APIView


import logging

logger = logging.getLogger(__name__)


class PaymentSummary(APIView):
    """Return aggregated payment info for the current client: total_spent and recent transactions."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            # If no client profile, return empty summary instead of 400 to improve UX
            if not hasattr(user, 'clientprofile'):
                return Response({'total_spent': 0, 'recent_transactions': []})

            client = user.clientprofile
            # total spent for completed transactions
            total = Transaction.objects.filter(client=client, status='COMPLETED').aggregate(total_spent=models.Sum('amount'))['total_spent'] or 0
            recent = Transaction.objects.filter(client=client).order_by('-created_at')[:10]
            serializer = TransactionSerializer(recent, many=True)
            return Response({'total_spent': total, 'recent_transactions': serializer.data})
        except Exception as exc:
            logger.exception('PaymentSummary failed')
            # In DEBUG this will include the error; otherwise return generic
            from django.conf import settings
            if getattr(settings, 'DEBUG', False):
                return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({'detail': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
