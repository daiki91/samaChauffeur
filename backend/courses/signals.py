from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Trip
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


@receiver(post_save, sender=Trip)
def trip_status_update(sender, instance: Trip, created, **kwargs):
    # Notify the trip group when a trip is created or status changes
    channel_layer = get_channel_layer()
    payload = {
        'type': 'trip_update',
        'trip_id': instance.id,
        'status': instance.status,
    }
    # include driver info when assigned
    if instance.driver:
        payload['driver_id'] = instance.driver.id
        payload['driver_phone'] = instance.driver.user.phone

    async_to_sync(channel_layer.group_send)(f'trip_{instance.id}', payload)
