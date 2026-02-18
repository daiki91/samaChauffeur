from decimal import Decimal, ROUND_HALF_UP
from .models import PricingRule


def find_price_per_km(vehicle_type: str, mode: str, region: str = None) -> Decimal:
    # search for most specific active rule: vehicle+mode+region, then vehicle+mode, then vehicle
    qs = PricingRule.objects.filter(vehicle_type=vehicle_type, mode=mode, active=True)
    if region:
        rule = qs.filter(region__iexact=region).first()
        if rule:
            return rule.price_per_km
    rule = qs.filter(region__isnull=True).first()
    if rule:
        return rule.price_per_km
    # fallback: any active rule for vehicle_type
    rule = PricingRule.objects.filter(vehicle_type=vehicle_type, active=True).first()
    if rule:
        return rule.price_per_km
    raise PricingRule.DoesNotExist('No pricing rule found for vehicle_type')


def estimate_price(distance_km: float, vehicle_type: str, mode: str = 'PRIVATE', region: str = None):
    per_km = find_price_per_km(vehicle_type, mode, region)
    price = (Decimal(distance_km) * Decimal(per_km)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return {
        'distance_km': round(float(distance_km), 3),
        'price_per_km': per_km,
        'price': price,
    }
