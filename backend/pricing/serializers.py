from rest_framework import serializers
from .models import PricingRule


class PricingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingRule
        fields = '__all__'
        read_only_fields = ('id',)


class EstimateSerializer(serializers.Serializer):
    distance_km = serializers.FloatField()
    vehicle_type = serializers.ChoiceField(choices=PricingRule.VEHICLE_TYPES)
    mode = serializers.ChoiceField(choices=PricingRule.MODE_CHOICES, default='PRIVATE')
    region = serializers.CharField(max_length=100, required=False, allow_blank=True)


class EstimateResultSerializer(serializers.Serializer):
    distance_km = serializers.FloatField()
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    price_per_km = serializers.DecimalField(max_digits=10, decimal_places=2)
