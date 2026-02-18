from django.db import models
from django.conf import settings


class Ticket(models.Model):
    passenger = models.ForeignKey('clients.ClientProfile', on_delete=models.CASCADE)
    line = models.ForeignKey('gares.Line', on_delete=models.CASCADE)
    seat_number = models.CharField(max_length=10, null=True, blank=True)
    status = models.CharField(max_length=20, default='ISSUED')
    issued_at = models.DateTimeField(auto_now_add=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"Ticket {self.id} for {self.passenger.user.phone} - {self.status}"