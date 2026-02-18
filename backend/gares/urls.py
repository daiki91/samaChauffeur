from django.urls import path
from .views import LineDetail, ScheduleDetail, StationDetail, StationListCreate, LineListCreate, ScheduleListCreate

urlpatterns = [
    path('stations/', StationListCreate.as_view(), name='stations'),
    path('stations/<int:pk>/', StationDetail.as_view(), name='station_detail'),
    path('lines/', LineListCreate.as_view(), name='lines'),
    path('lines/<int:pk>/', LineDetail.as_view(), name='line_detail'),
    path('schedules/', ScheduleListCreate.as_view(), name='schedules'),
    path('schedules/<int:pk>/', ScheduleDetail.as_view(), name='schedule_detail'),
]
