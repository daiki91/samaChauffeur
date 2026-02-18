from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from .models import ClientProfile, SupportTicket
from .serializers import ClientProfileSerializer, SupportTicketSerializer
from payments.serializers import PaymentMethodSerializer
from accounts.permissions import IsAdmin
from django.contrib.auth import get_user_model

User = get_user_model()


from rest_framework import generics


class ClientProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # return profile for current user
        try:
            profile = request.user.clientprofile
        except ClientProfile.DoesNotExist:
            return Response({'detail': 'No profile'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ClientProfileSerializer(profile)
        return Response(serializer.data)

    def post(self, request):
        # create profile for current user
        if hasattr(request.user, 'clientprofile'):
            return Response({'detail': 'Profile already exists'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ClientProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save(user=request.user)
        return Response(ClientProfileSerializer(profile).data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        try:
            profile = request.user.clientprofile
        except ClientProfile.DoesNotExist:
            return Response({'detail': 'No profile'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ClientProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ClientProfilesListCreate(generics.ListCreateAPIView):
    """Admin endpoint to list and create client profiles (Browsable form available)."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = ClientProfile.objects.all()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminClientProfileSerializer
        return ClientProfileSerializer


class PaymentMethodListCreate(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.clientprofile
        except ClientProfile.DoesNotExist:
            return Response({'detail': 'No profile'}, status=status.HTTP_404_NOT_FOUND)
        qs = profile.payment_methods.all()
        serializer = PaymentMethodSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        try:
            profile = request.user.clientprofile
        except ClientProfile.DoesNotExist:
            return Response({'detail': 'No profile'}, status=status.HTTP_404_NOT_FOUND)
        data = request.data.copy()
        data['client'] = profile.id
        # backwards compatibility: accept 'method' -> provider and 'data' -> details
        if 'method' in data and 'provider' not in data:
            data['provider'] = data.pop('method')
        if 'data' in data and 'details' not in data:
            data['details'] = data.pop('data')
        serializer = PaymentMethodSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        pm = serializer.save()
        # if marked default, unset others
        if pm.is_default:
            profile.payment_methods.exclude(id=pm.id).update(is_default=False)
        return Response(PaymentMethodSerializer(pm).data, status=status.HTTP_201_CREATED)


class SupportTicketCreate(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            profile = request.user.clientprofile
        except ClientProfile.DoesNotExist:
            return Response({'detail': 'No profile'}, status=status.HTTP_404_NOT_FOUND)
        data = request.data.copy()
        data['client'] = profile.id
        serializer = SupportTicketSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)
