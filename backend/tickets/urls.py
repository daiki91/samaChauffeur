from django.urls import path
from .views import TicketDetail, TicketListCreate, AdminTicketListCreate

urlpatterns = [
    path('', TicketListCreate.as_view(), name='tickets_list_create'),
    path('<int:pk>/', TicketDetail.as_view(), name='ticket_detail'),
    path('admin/', AdminTicketListCreate.as_view(), name='tickets_admin'),
]
