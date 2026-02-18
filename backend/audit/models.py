from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action_type = models.CharField(max_length=255)
    object_type = models.CharField(max_length=255, null=True, blank=True)
    object_id = models.CharField(max_length=128, null=True, blank=True)
    data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Audit {self.action_type} by {self.actor}"