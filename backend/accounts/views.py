from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.auth import get_user_model
from .serializers import OTPRequestSerializer, OTPVerifySerializer, RegisterSerializer, MyTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import datetime
from .models import OTP
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from .serializers import UserSerializer, AdminUserSerializer
from .permissions import IsSelfOrAdmin, IsAdmin

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({'id': user.id, 'phone': user.phone}, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .serializers import UserSerializer
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        from .serializers import UserSerializer
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception:
            return Response({'detail': 'Invalid token.'}, status=status.HTTP_400_BAD_REQUEST)


class OTPSendView(APIView):
    """Send OTP during registration/phone verification only.

    Behaviour changed: OTP can only be requested for an existing user whose
    phone is not yet verified. Returns 400 if the user does not exist or is
    already verified.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data['phone']

        # Ensure user exists and is not already verified
        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return Response({'detail': 'User not found. Register first.'}, status=status.HTTP_400_BAD_REQUEST)

        if getattr(user, 'phone_verified', False):
            return Response({'detail': 'Phone already verified.'}, status=status.HTTP_400_BAD_REQUEST)

        # generate code and expiry
        from datetime import datetime, timedelta
        from .sms import generate_otp, DevStubProvider
        from .models import OTP

        from django.utils import timezone
        code = generate_otp()
        expires_at = timezone.now() + timedelta(minutes=5)

        # Save OTP
        otp = OTP.objects.create(phone=phone, code=code, expires_at=expires_at)

        # Choose provider: Twilio if configured, otherwise DevStub
        from django.conf import settings
        try:
            if settings.TWILIO.get('ACCOUNT_SID') and settings.TWILIO.get('AUTH_TOKEN') and settings.TWILIO.get('FROM_NUMBER'):
                from .sms import TwilioProvider
                provider = TwilioProvider(settings.TWILIO['ACCOUNT_SID'], settings.TWILIO['AUTH_TOKEN'], settings.TWILIO['FROM_NUMBER'])
            else:
                provider = DevStubProvider()
        except Exception:
            # fallback to stub on any issue (missing deps, etc.)
            provider = DevStubProvider()

        provider.send(phone, f"Your SamaChauffeur OTP code is: {code}")

        return Response({'detail': 'OTP sent'}, status=status.HTTP_200_OK)


class OTPVerifyView(APIView):
    """Verify OTP during registration only.

    Behaviour changed: verifying an OTP no longer issues JWT tokens. Instead
    it marks the corresponding user's `phone_verified=True`. The user **must**
    exist (created via `/auth/register/`) — verification will fail otherwise.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data['phone']
        code = serializer.validated_data['code']

        # Find OTP
        try:
            otp = OTP.objects.filter(phone=phone, is_used=False).latest('created_at')
        except OTP.DoesNotExist:
            return Response({'detail': 'No OTP found'}, status=status.HTTP_400_BAD_REQUEST)

        if otp.code != code:
            otp.attempts += 1
            otp.save()
            return Response({'detail': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone
        if otp.expires_at < timezone.now():
            return Response({'detail': 'OTP expired'}, status=status.HTTP_400_BAD_REQUEST)

        # Mark OTP used
        otp.is_used = True
        otp.save()

        # User must already exist (registration flow creates user first)
        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return Response({'detail': 'User not found. Register first.'}, status=status.HTTP_400_BAD_REQUEST)

        user.phone_verified = True
        user.save()

        return Response({'detail': 'Phone verified'}, status=status.HTTP_200_OK)


from rest_framework import generics


class UsersListCreate(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminUserSerializer
        return UserSerializer


class UserDetail(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSelfOrAdmin]

    def get_object(self, pk):
        return get_object_or_404(User, pk=pk)

    def get(self, request, pk):
        user = self.get_object(pk)
        self.check_object_permissions(request, user)
        serializer = UserSerializer(user)
        return Response(serializer.data)

    def patch(self, request, pk):
        user = self.get_object(pk)
        self.check_object_permissions(request, user)
        serializer = AdminUserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, pk):
        user = self.get_object(pk)
        # only admin can delete
        if not request.user.is_staff and request.user.role != 'ADMIN':
            return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
