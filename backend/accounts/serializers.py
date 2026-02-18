from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'phone', 'password', 'role', 'language')

    def validate_role(self, value):
        # Public registration endpoint must not allow creation of ADMIN users
        if value == 'ADMIN':
            raise serializers.ValidationError('Cannot assign ADMIN role during registration.')
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['role'] = user.role
        token['phone'] = user.phone
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['role'] = self.user.role
        data['phone'] = self.user.phone
        data['username'] = self.user.username
        return data


# OTP serializers
class OTPRequestSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)


class OTPVerifySerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=6)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'phone', 'role', 'language')
        read_only_fields = ('id', 'phone', 'role')


class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'phone', 'password', 'role', 'language')
        read_only_fields = ('id',)

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
