from django.urls import path
from .views import PricingRuleListCreate, EstimateView

urlpatterns = [
    path('rules/', PricingRuleListCreate.as_view(), name='pricing_rules'),
    path('estimate/', EstimateView.as_view(), name='pricing_estimate'),
]
