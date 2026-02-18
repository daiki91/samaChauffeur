from django.db import models
from django.conf import settings


class Transaction(models.Model):
    METHOD_CHOICES = (
        ('ORANGE', 'Orange Money'),
        ('WAVE', 'Wave'),
        ('FREE', 'Free Money'),
        ('CASH', 'Espèces'),
        ('CARD', 'Card'),
    )
    STATUS = (
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    )

    client = models.ForeignKey('clients.ClientProfile', on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, default='XOF')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS, default='PENDING')
    reference = models.CharField(max_length=128, null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Transaction {self.id} {self.amount} {self.currency} {self.status}" 


class PaymentMethod(models.Model):
    client = models.ForeignKey('clients.ClientProfile', on_delete=models.CASCADE, related_name='payment_methods')
    provider = models.CharField(max_length=30)
    details = models.JSONField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    related_name='payment_transactions_methods'

    def __str__(self):
        return f"{self.client.user.phone} - {self.provider} {'(default)' if self.is_default else ''}"


class Payout(models.Model):
    chauffeur = models.ForeignKey('chauffeurs.Chauffeur', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=(('SCHEDULED', 'Scheduled'), ('PROCESSED', 'Processed'), ('FAILED', 'Failed')), default='SCHEDULED')
    scheduled_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"Payout {self.id} to {self.chauffeur.user.phone} - {self.amount}"