from django.db import models
from django.conf import settings


class Trip(models.Model):
    STATUS_CHOICES = (
        ('REQUESTED', 'Requested'),
        ('ASSIGNED', 'Assigned'),
        ('ACCEPTED', 'Accepted'),
        ('STARTED', 'Started'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )

    MODE_CHOICES = (
        ('PRIVATE', 'Privé'),
        ('SHARED', 'Partagé'),
        ('BUS', 'Bus'),
    )

    passenger = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trips')
    driver = models.ForeignKey('chauffeurs.Chauffeur', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_trips')

    origin = models.CharField(max_length=255)
    origin_lat = models.FloatField(null=True, blank=True)
    origin_lng = models.FloatField(null=True, blank=True)

    destination = models.CharField(max_length=255)
    dest_lat = models.FloatField(null=True, blank=True)
    dest_lng = models.FloatField(null=True, blank=True)

    distance_km = models.FloatField(null=True, blank=True)
    estimated_duration = models.IntegerField(null=True, blank=True)  # minutes

    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='PRIVATE')
    price = models.IntegerField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='REQUESTED')

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Trip {self.id} {self.origin} -> {self.destination} ({self.status})"


class TripPassenger(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='passengers')
    passenger = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    seat_number = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"TripPassenger {self.trip.id} - {self.passenger.phone}"
