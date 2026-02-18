from django.contrib import admin
from .models import Transaction, PaymentMethod, Payout


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'client', 'amount', 'status', 'created_at')


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ('id', 'client')


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ('id', 'chauffeur', 'amount', 'status')
