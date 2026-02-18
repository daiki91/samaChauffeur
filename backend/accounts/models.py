from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = (
        ('CLIENT', 'Client'),
        ('CHAUFFEUR', 'Chauffeur'),
        ('ADMIN', 'Admin'),
    )

    phone = models.CharField(max_length=20, unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='CLIENT')
    language = models.CharField(
        max_length=5,
        choices=[('fr', 'Français'), ('wo', 'Wolof')],
        default='fr'
    )
    # Indicates whether the phone number has been verified via OTP during registration
    phone_verified = models.BooleanField(default=False)

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f"{self.phone} ({self.get_role_display()})"


class OTP(models.Model):
    phone = models.CharField(max_length=20)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=['phone'])]

    def __str__(self):
        return f"OTP {self.code} for {self.phone} (used={self.is_used})"

    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    def mark_used(self):
        self.is_used = True
        self.save()
