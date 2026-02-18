from django.urls import path
from .views import ApplyChauffeurView, VerifyChauffeurView, SetLocationView, VehicleListCreate, ChauffeurListCreate, AvailableChauffeursList

urlpatterns = [
    path('apply/', ApplyChauffeurView.as_view(), name='apply_chauffeur'),
    path('verify/<int:pk>/', VerifyChauffeurView.as_view(), name='verify_chauffeur'),
    path('available/', AvailableChauffeursList.as_view(), name='available_chauffeurs'),
    path('location/', SetLocationView.as_view(), name='set_location'),
    path('vehicles/', VehicleListCreate.as_view(), name='vehicles_list_create'),
    path('admin/chauffeurs/', ChauffeurListCreate.as_view(), name='admin_chauffeurs'),
]
