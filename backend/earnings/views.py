from rest_framework import generics, views, status
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from .models import CommissionRule, EarningEntry
from .serializers import CommissionRuleSerializer, EarningEntrySerializer
from accounts.permissions import IsAdmin
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum

class CommissionRuleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdmin]
    queryset = CommissionRule.objects.all().order_by('-id')
    serializer_class = CommissionRuleSerializer

class CommissionRuleDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdmin]
    queryset = CommissionRule.objects.all()
    serializer_class = CommissionRuleSerializer

class EarningEntryListView(generics.ListAPIView):
    permission_classes = [IsAdmin]
    serializer_class = EarningEntrySerializer

    def get_queryset(self):
        queryset = EarningEntry.objects.all().order_by('-created_at')
        
        agent_id = self.request.query_params.get('agent')
        status_param = self.request.query_params.get('status')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if agent_id:
            queryset = queryset.filter(agent_id=agent_id)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
            
        return queryset

class ApproveEarningView(views.APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, id):
        try:
            with transaction.atomic():
                entry = EarningEntry.objects.select_for_update().get(id=id)
                if entry.status != 'pending':
                    return Response({'detail': 'Can only approve pending entries.'}, status=status.HTTP_400_BAD_REQUEST)
                
                entry.status = 'approved'
                entry.save()
                return Response(EarningEntrySerializer(entry).data)
        except EarningEntry.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

class MarkPaidEarningView(views.APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, id):
        try:
            with transaction.atomic():
                entry = EarningEntry.objects.select_for_update().get(id=id)
                if entry.status == 'paid':
                    return Response({'detail': 'Already paid.'}, status=status.HTTP_400_BAD_REQUEST)
                
                entry.status = 'paid'
                entry.paid_at = timezone.now()
                entry.paid_by = request.user
                entry.save()
                return Response(EarningEntrySerializer(entry).data)
        except EarningEntry.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

class AgentEarningsSummaryView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        # Allow if admin or if the agent themselves
        if request.user.role != 'admin' and str(request.user.id) != str(id):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
            
        entries = EarningEntry.objects.filter(agent_id=id).order_by('-created_at')
        
        pending_total = entries.filter(status='pending').aggregate(total=Sum('amount'))['total'] or 0
        approved_total = entries.filter(status='approved').aggregate(total=Sum('amount'))['total'] or 0
        paid_total = entries.filter(status='paid').aggregate(total=Sum('amount'))['total'] or 0

        # Optional: return a small snippet of recent history, or they could hit another endpoint for full history.
        # But the prompt says "showing their own EarningEntry history and running totals ... pulled from GET /api/v1/agents/{id}/earnings-summary"
        
        serializer = EarningEntrySerializer(entries, many=True)

        return Response({
            'pending_total': pending_total,
            'approved_total': approved_total,
            'paid_total': paid_total,
            'history': serializer.data
        })
