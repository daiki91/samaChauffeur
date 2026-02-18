from django.db import models


class SystemSetting(models.Model):
    key = models.CharField(max_length=255, unique=True)
    value = models.TextField()
    type = models.CharField(max_length=32, default='string')

    def __str__(self):
        return f"{self.key} = {self.value}"