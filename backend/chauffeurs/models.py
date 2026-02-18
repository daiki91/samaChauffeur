from django.db import models
from django.conf import settings


class Vehicle(models.Model):
    TYPE_CHOICES = (
        ('CAR', 'Voiture'),
        ('SEDAN', 'Berline'),
        ('SUV', '4x4'),
        ('MINIBUS', 'Minibus'),
        ('BUS', 'Bus rapide'),
    )

    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    seats = models.IntegerField()
    plate_number = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"{self.plate_number} ({self.get_type_display()})"


class Chauffeur(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)

    permit = models.FileField(upload_to='documents/', null=True, blank=True)
    insurance = models.FileField(upload_to='documents/', null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)

    # Current GPS location (updated by driver client)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"Chauffeur {self.user.phone} - Verified: {self.is_verified}"

    def set_location(self, lat: float, lon: float):
        self.latitude = lat
        self.longitude = lon
        self.save()
