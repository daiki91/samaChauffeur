from rest_framework import serializers
from .models import Transaction, PaymentMethod, Payout


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = '__all__'
        read_only_fields = ('id', 'created_at')


class PayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payout
        fields = '__all__'
        read_only_fields = ('id',)
