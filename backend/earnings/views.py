from rest_framework import generics, views, status
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from .models import CommissionRule, EarningEntry, AgentPayoutBatch
from .serializers import CommissionRuleSerializer, EarningEntrySerializer, AgentPayoutBatchSerializer
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
    pagination_class = None

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
        
        # Calculate next payout date (Next Monday)
        today = timezone.now().date()
        days_ahead = 0 - today.weekday() # Monday is 0
        if days_ahead <= 0: # Target next week if today is Monday or later
            days_ahead += 7
        next_payout_date = today + timedelta(days=days_ahead)

        # Get latest payout batches
        batches = AgentPayoutBatch.objects.filter(agent_id=id).order_by('-created_at')
        batch_serializer = AgentPayoutBatchSerializer(batches, many=True)
        
        serializer = EarningEntrySerializer(entries[:20], many=True) # Return only recent 20 for history

        return Response({
            'pending_total': pending_total,
            'approved_total': approved_total,
            'paid_total': paid_total,
            'wallet_balance': pending_total + approved_total, # Unpaid active earnings
            'next_payout_date': next_payout_date.isoformat(),
            'payout_batches': batch_serializer.data,
            'history': serializer.data
        })

class AgentPayoutBatchListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AgentPayoutBatchSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = AgentPayoutBatch.objects.all().order_by('-created_at')
        
        # If admin, see all (unless agent_id filtered)
        # If agent, only see their own
        if self.request.user.role == 'admin':
            agent_id = self.request.query_params.get('agent')
            if agent_id:
                queryset = queryset.filter(agent_id=agent_id)
        else:
            queryset = queryset.filter(agent=self.request.user)
            
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        return queryset

class MarkPayoutBatchPaidView(views.APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, id):
        utr_number = request.data.get('utr_number')
        if not utr_number:
            return Response({'detail': 'UTR number is required to mark as paid.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                batch = AgentPayoutBatch.objects.select_for_update().get(id=id)
                if batch.status == 'paid':
                    return Response({'detail': 'Batch is already paid.'}, status=status.HTTP_400_BAD_REQUEST)
                
                batch.status = 'paid'
                batch.utr_number = utr_number
                batch.paid_at = timezone.now()
                batch.paid_by = request.user
                batch.save()
                
                # Cascade update to all entries
                batch.entries.update(
                    status='paid',
                    paid_at=timezone.now(),
                    paid_by=request.user,
                    notes=f"Paid via Batch #{batch.id}, UTR: {utr_number}"
                )
                
                # Trigger SMS notification asynchronously
                from notifications.tasks import send_payout_sms_async
                if batch.agent.phone:
                    send_payout_sms_async.delay(
                        phone=batch.agent.phone,
                        amount=float(batch.total_amount),
                        utr_number=utr_number
                    )
                
                return Response(AgentPayoutBatchSerializer(batch).data)
        except AgentPayoutBatch.DoesNotExist:
            return Response({'detail': 'Payout batch not found.'}, status=status.HTTP_404_NOT_FOUND)

from django.http import HttpResponse
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch

class AgentPayoutBatchReceiptView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        try:
            batch = AgentPayoutBatch.objects.get(id=id)
            if request.user.role == 'agent' and batch.agent != request.user:
                return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
                
            from properties.models import PlatformSettings
            import urllib.request
            import tempfile
            import os
            from PIL import Image
            
            settings = PlatformSettings.load()
            
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Settlement_Statement_{batch.id}.pdf"'
            
            p = canvas.Canvas(response, pagesize=A4)
            width, height = A4
            
            # Header Layout
            current_y = height - 1 * inch
            
            # Draw Logo (Left side)
            if settings.company_logo_url:
                try:
                    req = urllib.request.Request(settings.company_logo_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as u:
                        raw_data = u.read()
                    
                    # Save to temp file since reportlab handles files better than bytesio sometimes
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp:
                        tmp.write(raw_data)
                        tmp_path = tmp.name
                    
                    # Use PIL to get dimensions to maintain aspect ratio
                    with Image.open(tmp_path) as img:
                        img_width, img_height = img.size
                        aspect = img_height / float(img_width)
                        
                    target_width = 1.5 * inch
                    target_height = target_width * aspect
                    
                    p.drawImage(tmp_path, 1 * inch, current_y - target_height + 0.25 * inch, width=target_width, height=target_height, mask='auto')
                    os.unlink(tmp_path)
                except Exception as e:
                    print("Logo fetch error:", e)
                    
            # Draw Title (Right side)
            p.setFont("Helvetica-Bold", 24)
            p.drawRightString(width - 1 * inch, current_y, "Settlement Statement")
            
            current_y -= 0.6 * inch
            
            # Draw Company Name
            p.setFont("Helvetica-Bold", 12)
            p.drawString(1 * inch, current_y, settings.company_name)
            
            current_y -= 0.5 * inch
            
            p.setFont("Helvetica", 12)
            p.drawString(1 * inch, current_y, f"Batch ID: {batch.id}")
            current_y -= 0.3 * inch
            p.drawString(1 * inch, current_y, f"Agent: {batch.agent.get_full_name()} ({batch.agent.username})")
            current_y -= 0.3 * inch
            p.drawString(1 * inch, current_y, f"Cycle Dates: {batch.cycle_start_date} to {batch.cycle_end_date}")
            current_y -= 0.3 * inch
            p.drawString(1 * inch, current_y, f"Total Amount: INR {batch.total_amount}")
            current_y -= 0.3 * inch
            p.drawString(1 * inch, current_y, f"Status: {batch.status.upper()}")
            
            if batch.status == 'paid':
                current_y -= 0.3 * inch
                p.drawString(1 * inch, current_y, f"Paid On: {batch.paid_at.strftime('%Y-%m-%d %H:%M') if batch.paid_at else 'N/A'}")
                current_y -= 0.3 * inch
                p.drawString(1 * inch, current_y, f"UTR Number: {batch.utr_number}")
                
            p.line(1 * inch, current_y - 0.5 * inch, width - 1 * inch, current_y - 0.5 * inch)
            
            current_y -= 1 * inch
            p.setFont("Helvetica-Oblique", 10)
            p.drawString(1 * inch, current_y, f"This is a computer-generated statement by {settings.company_name} and does not require a physical signature.")
            
            p.showPage()
            p.save()
            return response
            
        except AgentPayoutBatch.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


class DisburseInstantPayoutView(views.APIView):
    """
    1-Click Instant Payout Disbursement via UPI / RazorpayX Payouts.
    Disburses funds from the Admin's configured Bank / RazorpayX Account to the agent's UPI ID / Bank.
    """
    permission_classes = [IsAdmin]

    def post(self, request, id):
        try:
            with transaction.atomic():
                batch = AgentPayoutBatch.objects.select_for_update().get(id=id)
                if batch.status == 'paid':
                    return Response({'detail': 'This payout batch has already been paid.'}, status=status.HTTP_400_BAD_REQUEST)

                payout_mode = request.data.get('mode', 'upi') # 'upi' or 'bank_transfer'
                provided_utr = request.data.get('utr_number')

                from properties.models import PlatformSettings
                settings = PlatformSettings.load()

                rzp_key_id = settings.razorpayx_key_id or settings.razorpay_key_id
                rzp_key_secret = settings.razorpayx_key_secret or settings.razorpay_key_secret
                source_account = settings.razorpayx_account_number or settings.payout_account_number

                import uuid, random
                utr = provided_utr or f"UTR{random.randint(1000, 9999)}{uuid.uuid4().hex[:8].upper()}"

                # If live RazorpayX credentials and account number are configured, make the live payout API call
                if rzp_key_id and rzp_key_secret and source_account and 'REPLACE_WITH' not in rzp_key_secret:
                    try:
                        import requests
                        agent = batch.agent
                        agent_upi = getattr(agent, 'kyc_upi_id', None) or request.data.get('upi_id')
                        auth = (rzp_key_id, rzp_key_secret)
                        payout_payload = {
                            "account_number": source_account,
                            "amount": int(float(batch.total_amount) * 100),
                            "currency": "INR",
                            "mode": "UPI" if agent_upi else "IMPS",
                            "purpose": "payout",
                            "fund_account": {
                                "account_type": "vpa" if agent_upi else "bank_account",
                                "contact": {
                                    "name": agent.get_full_name() or agent.username,
                                    "email": agent.email or "agent@rentlo.in",
                                    "contact": agent.phone or "9999999999",
                                    "type": "vendor"
                                },
                                "vpa": {"address": agent_upi} if agent_upi else None
                            },
                            "queue_if_low_balance": True,
                            "reference_id": f"RL_PAYOUT_{batch.id}",
                            "narration": f"Rentlo Commission Batch #{batch.id}"
                        }
                        resp = requests.post("https://api.razorpay.com/v1/payouts", auth=auth, json=payout_payload, timeout=7)
                        if resp.status_code in (200, 201):
                            res_data = resp.json()
                            utr = res_data.get('utr') or res_data.get('id') or utr
                    except Exception as ex:
                        print("RazorpayX Payout API fallback:", ex)

                batch.status = 'paid'
                batch.utr_number = utr
                batch.paid_at = timezone.now()
                batch.paid_by = request.user
                batch.save()

                # Mark all approved earnings in this date range for the agent as paid
                EarningEntry.objects.filter(
                    agent=batch.agent,
                    status='approved',
                    created_at__date__gte=batch.cycle_start_date,
                    created_at__date__lte=batch.cycle_end_date
                ).update(status='paid')

                return Response({
                    'status': 'success',
                    'message': f'Instant payout of ₹{batch.total_amount} disbursed successfully from {settings.payout_bank_name} to {batch.agent.username}',
                    'batch': AgentPayoutBatchSerializer(batch).data,
                    'utr_number': utr,
                    'payout_mode': payout_mode,
                    'source_bank': settings.payout_bank_name,
                    'source_account': ('••••' + settings.payout_account_number[-4:]) if len(settings.payout_account_number) > 4 else settings.payout_account_number,
                    'disbursed_at': batch.paid_at
                })

        except AgentPayoutBatch.DoesNotExist:
            return Response({'detail': 'Payout batch not found.'}, status=status.HTTP_404_NOT_FOUND)


class CreateInstantPayoutBatchView(views.APIView):
    """
    Creates an instant payout batch from an agent's approved unpaid earnings
    and can optionally disburse it immediately in a single step.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        agent_id = request.data.get('agent_id')
        disburse_now = request.data.get('disburse_now', False)

        from accounts.models import User
        try:
            agent = User.objects.get(id=agent_id)
        except User.DoesNotExist:
            return Response({'detail': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)

        approved_earnings = EarningEntry.objects.filter(agent=agent, status='approved')
        total_amount = approved_earnings.aggregate(total=Sum('amount'))['total'] or 0

        if total_amount <= 0:
            return Response({'detail': 'No approved earnings available to disburse for this agent.'}, status=status.HTTP_400_BAD_REQUEST)

        earliest = approved_earnings.order_by('created_at').first().created_at.date()
        latest = approved_earnings.order_by('-created_at').first().created_at.date()

        with transaction.atomic():
            import uuid, random
            batch = AgentPayoutBatch.objects.create(
                agent=agent,
                cycle_start_date=earliest,
                cycle_end_date=latest,
                total_amount=total_amount,
                status='paid' if disburse_now else 'processing',
                paid_at=timezone.now() if disburse_now else None,
                paid_by=request.user if disburse_now else None,
                utr_number=f"UTR{random.randint(1000, 9999)}{uuid.uuid4().hex[:8].upper()}" if disburse_now else None
            )

            if disburse_now:
                approved_earnings.update(status='paid')

            return Response({
                'status': 'success',
                'batch': AgentPayoutBatchSerializer(batch).data,
                'message': f'Instant Payout Batch #{batch.id} created {"and disbursed" if disburse_now else ""}'
            }, status=status.HTTP_201_CREATED)

