from rest_framework import serializers
from .models import Station, Line, LineStop, Schedule


class StationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Station
        fields = '__all__'


class LineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Line
        fields = '__all__'


class ScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = '__all__'