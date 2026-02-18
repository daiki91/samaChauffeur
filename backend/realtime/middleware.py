from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from rest_framework_simplejwt.authentication import JWTAuthentication
from asgiref.sync import sync_to_async
from django.contrib.auth.models import AnonymousUser


class JWTAuthMiddleware(BaseMiddleware):
    """JWT auth middleware for Channels. Reads token from querystring `?token=` and sets `scope['user']`."""

    async def __call__(self, scope, receive, send):
        scope["user"] = AnonymousUser()

        query_string = scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        token = query_params.get("token")

        if token:
            try:
                validated = JWTAuthentication().get_validated_token(token[0])
                user = await sync_to_async(JWTAuthentication().get_user)(validated)
                scope["user"] = user
            except Exception as exc:
                # Log token validation errors for easier debugging
                import logging
                logger = logging.getLogger(__name__)
                logger.exception('JWTAuthMiddleware token validation failed')
                # leave as anonymous on any failure
                pass

        return await super().__call__(scope, receive, send)
