"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from realtime.middleware import JWTAuthMiddleware
import realtime.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # Use JWTAuthMiddleware for websockets
    "websocket": JWTAuthMiddleware(
        URLRouter(
            realtime.routing.websocket_urlpatterns
        )
    ),
})
