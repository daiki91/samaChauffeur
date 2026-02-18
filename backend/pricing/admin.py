from django.contrib import admin
from .models import PricingRule


@admin.register(PricingRule)
class PricingRuleAdmin(admin.ModelAdmin):
    list_display = ('vehicle_type', 'mode', 'region', 'price_per_km', 'active')
    list_filter = ('vehicle_type', 'mode', 'region', 'active')
    search_fields = ('region',)
