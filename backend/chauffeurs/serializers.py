from rest_framework import serializers
from .models import Vehicle, Chauffeur
from django.contrib.auth import get_user_model

User = get_user_model()


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ('id', 'type', 'seats', 'plate_number')


class ChauffeurSerializer(serializers.ModelSerializer):
    vehicle = VehicleSerializer(required=False)

    class Meta:
        model = Chauffeur
        fields = ('id', 'user', 'vehicle', 'is_verified', 'is_available')
        read_only_fields = ('id', 'user', 'is_verified', 'is_available')


class AdminChauffeurSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    vehicle = serializers.PrimaryKeyRelatedField(queryset=Vehicle.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Chauffeur
        fields = ('id', 'user', 'vehicle', 'is_verified', 'is_available')
        read_only_fields = ('id',)

    def create(self, validated_data):
        return Chauffeur.objects.create(**validated_data)


class ChauffeurAvailableSerializer(serializers.ModelSerializer):
    """Serializer used by clients to locate nearby available chauffeurs."""
    phone = serializers.CharField(source='user.phone')
    username = serializers.CharField(source='user.username')
    vehicle = VehicleSerializer(required=False)

    class Meta:
        model = Chauffeur
        fields = ('id', 'phone', 'username', 'vehicle', 'is_available', 'latitude', 'longitude')
        read_only_fields = fields
