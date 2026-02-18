from django.db import models


class Station(models.Model):
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=255)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.city})"


class Line(models.Model):
    name = models.CharField(max_length=255)
    origin = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='lines_origin')
    destination = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='lines_destination')
    stops = models.ManyToManyField(Station, related_name='lines', through='LineStop')

    def __str__(self):
        return f"{self.name} - {self.origin.name} → {self.destination.name}"


class LineStop(models.Model):
    line = models.ForeignKey(Line, on_delete=models.CASCADE)
    station = models.ForeignKey(Station, on_delete=models.CASCADE)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ['order']
        unique_together = ('line', 'station')


class Schedule(models.Model):
    line = models.ForeignKey(Line, on_delete=models.CASCADE)
    departure_time = models.TimeField()
    arrival_time = models.TimeField()
    days_of_week = models.CharField(max_length=64, default='Mon-Fri')
    price_base = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    def __str__(self):
        return f"Schedule {self.id} for {self.line.name}"