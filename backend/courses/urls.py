from django.urls import path
from .views import AcceptTripView, AvailableTripsList, ClaimTripView, CreateTripView, EndTripView, MyTripsList, RejectTripView, StartTripView, TripDetailView

urlpatterns = [
    path('create/', CreateTripView.as_view(), name='create_trip'),
    path('available/', AvailableTripsList.as_view(), name='available_trips'),
    path('claim/<int:pk>/', ClaimTripView.as_view(), name='claim_trip'),
    path('my/', MyTripsList.as_view(), name='my_trips'),
    path('<int:pk>/', TripDetailView.as_view(), name='trip_detail'),
    path('<int:pk>/accept/', AcceptTripView.as_view(), name='accept_trip'),
    path('<int:pk>/reject/', RejectTripView.as_view(), name='reject_trip'),
    path('<int:pk>/start/', StartTripView.as_view(), name='start_trip'),
    path('<int:pk>/end/', EndTripView.as_view(), name='end_trip'),
]
