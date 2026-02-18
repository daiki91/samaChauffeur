from django.db import models


class PricingRule(models.Model):
    VEHICLE_TYPES = (
        ('CAR', 'Voiture'),
        ('SEDAN', 'Berline'),
        ('SUV', '4x4'),
        ('MINIBUS', 'Minibus'),
        ('BUS', 'Bus rapide'),
    )

    MODE_CHOICES = (
        ('PRIVATE', 'Privé'),
        ('SHARED', 'Partagé'),
        ('BUS', 'Bus'),
    )

    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPES)
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='PRIVATE')
    region = models.CharField(max_length=100, blank=True, null=True)
    price_per_km = models.DecimalField(max_digits=10, decimal_places=2)
    active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Pricing Rule"
        verbose_name_plural = "Pricing Rules"
        ordering = ['vehicle_type', 'mode', 'region']

    def __str__(self):
        return f"{self.get_vehicle_type_display()} - {self.get_mode_display()} - {self.region or 'all'}: {self.price_per_km} FCFA/km"
