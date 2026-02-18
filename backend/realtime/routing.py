from django.urls import re_path
from .consumers import DriverLocationConsumer, TripNotificationConsumer, DriversBroadcastConsumer

websocket_urlpatterns = [
    re_path(r'ws/realtime/driver/$', DriverLocationConsumer.as_asgi()),
    re_path(r'ws/realtime/drivers/$', DriversBroadcastConsumer.as_asgi()),
    re_path(r'ws/realtime/trip/(?P<trip_id>[^/]+)/$', TripNotificationConsumer.as_asgi()),
]
