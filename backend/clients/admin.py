from django.contrib import admin
from .models import ClientProfile, SupportTicket


@admin.register(ClientProfile)
class ClientProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'is_active', 'language', 'created_at')
    search_fields = ('user__phone', 'user__username')


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'client', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('client__user__phone', 'title')