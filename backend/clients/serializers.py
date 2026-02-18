from rest_framework import serializers
from .models import ClientProfile, SupportTicket
from django.contrib.auth import get_user_model
from payments.serializers import PaymentMethodSerializer

User = get_user_model()


class ClientProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ClientProfile
        fields = ('id', 'user', 'photo', 'is_active', 'language', 'created_at')
        read_only_fields = ('id', 'user', 'created_at')


class AdminClientProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = ClientProfile
        fields = ('id', 'user', 'photo', 'is_active', 'language', 'created_at')
        read_only_fields = ('id', 'created_at')




class SupportTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = ('id', 'client', 'trip', 'title', 'description', 'status', 'created_at')
        read_only_fields = ('id', 'created_at', 'status')
