from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .serializers import PricingRuleSerializer, EstimateSerializer, EstimateResultSerializer
from .models import PricingRule
from .services import estimate_price


class PricingRuleListCreate(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = PricingRule.objects.all()
        serializer = PricingRuleSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        # only admin should create; we'll check is_staff for now
        if not request.user.is_staff:
            return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PricingRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class EstimateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = EstimateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = estimate_price(data['distance_km'], data['vehicle_type'], data.get('mode'), data.get('region'))
            out = EstimateResultSerializer(result)
            return Response(out.data)
        except PricingRule.DoesNotExist:
            return Response({'detail': 'No pricing rule found'}, status=status.HTTP_400_BAD_REQUEST)
