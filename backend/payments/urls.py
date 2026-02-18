from django.urls import path
from .views import PaymentMethodDetail, TransactionDetail, TransactionListCreate, PaymentMethodListCreate, PayoutListCreate, PaymentSummary, ValidateTransaction, PendingTransactionsForDriver

urlpatterns = [
    path('transactions/', TransactionListCreate.as_view(), name='transactions'),
    path('transactions/<int:pk>/', TransactionDetail.as_view(), name='transaction_detail'),
    path('transactions/<int:pk>/validate/', ValidateTransaction.as_view(), name='transaction_validate'),
    path('transactions/pending/driver/', PendingTransactionsForDriver.as_view(), name='transactions_pending_driver'),
    path('methods/', PaymentMethodListCreate.as_view(), name='payment_methods'),
    path('methods/<int:pk>/', PaymentMethodDetail.as_view(), name='payment_method_detail'),
    path('payouts/', PayoutListCreate.as_view(), name='payouts'),
    path('summary/', PaymentSummary.as_view(), name='payment_summary'),
]
