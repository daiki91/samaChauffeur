from django.urls import path
from .views import ClientProfileView, PaymentMethodListCreate, SupportTicketCreate, ClientProfilesListCreate

urlpatterns = [
    path('profile/', ClientProfileView.as_view(), name='client_profile'),
    path('payment-methods/', PaymentMethodListCreate.as_view(), name='payment_methods'),
    path('tickets/', SupportTicketCreate.as_view(), name='support_tickets'),
    path('profiles/', ClientProfilesListCreate.as_view(), name='client_profiles'),
]
