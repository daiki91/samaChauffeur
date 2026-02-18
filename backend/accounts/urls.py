from django.urls import path
from .views import MeView, MyTokenObtainPairView, LogoutView, RegisterView, OTPSendView, OTPVerifyView, UsersListCreate, UserDetail
from rest_framework_simplejwt.views import TokenRefreshView as SimpleTokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', MeView.as_view(), name='me'),
    path('users/', UsersListCreate.as_view(), name='users_list_create'),
    path('users/<int:pk>/', UserDetail.as_view(), name='user_detail'),
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', SimpleTokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('otp/send/', OTPSendView.as_view(), name='otp_send'),
    path('otp/verify/', OTPVerifyView.as_view(), name='otp_verify'),
]
