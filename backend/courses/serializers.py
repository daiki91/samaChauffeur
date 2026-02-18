from rest_framework import serializers
from .models import Trip


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = '__all__'
        read_only_fields = ('id', 'passenger', 'driver', 'status', 'created_at')


class TripCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = ('origin', 'origin_lat', 'origin_lng', 'destination', 'dest_lat', 'dest_lng', 'mode')

    def validate(self, attrs):
        if (attrs.get('origin_lat') is None) != (attrs.get('origin_lng') is None):
            raise serializers.ValidationError('Both origin_lat and origin_lng must be provided together')
        if (attrs.get('dest_lat') is None) != (attrs.get('dest_lng') is None):
            raise serializers.ValidationError('Both dest_lat and dest_lng must be provided together')
        return attrs
