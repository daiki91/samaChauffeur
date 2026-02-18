from django.contrib import admin
from .models import Vehicle, Chauffeur


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('plate_number', 'type', 'seats')
    search_fields = ('plate_number',)


@admin.register(Chauffeur)
class ChauffeurAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle', 'is_verified', 'is_available')
    search_fields = ('user__phone',)
    list_filter = ('is_verified', 'is_available')
