from django.db import models
from django.conf import settings


class ClientProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    photo = models.ImageField(upload_to='clients/photos/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    language = models.CharField(max_length=5, choices=[('fr', 'Français'), ('wo', 'Wolof')], default='fr')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Client {self.user.phone} (active={self.is_active})"


class SupportTicket(models.Model):
    STATUS = (
        ('OPEN', 'Open'),
        ('IN_PROGRESS', 'In progress'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
    )

    client = models.ForeignKey(ClientProfile, on_delete=models.CASCADE, related_name='tickets')
    trip = models.ForeignKey('courses.Trip', on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS, default='OPEN')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Ticket {self.id} ({self.status}) for {self.client.user.phone}"
