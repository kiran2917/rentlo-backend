import razorpay
import hmac
import hashlib
import logging
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from rest_framework import views, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from properties.models import Property
from properties.serializers import PropertySerializer
from .models import Unlock

logger = logging.getLogger(__name__)

# Initialize Razorpay client from env vars (fallback baseline)
try:
    razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
except Exception:
    razorpay_client = None

def _get_effective_razorpay_keys():
    """
    Returns (key_id, key_secret) — prefers DB PlatformSettings over env vars.
    DB keys take effect immediately after admin saves them (no restart needed).
    """
    try:
        from properties.models import PlatformSettings
        ps = PlatformSettings.load()
        db_id = (ps.razorpay_key_id or '').strip()
        db_secret = (ps.razorpay_key_secret or '').strip()
        if db_id and db_secret and 'REPLACE_WITH' not in db_secret:
            return db_id, db_secret
    except Exception:
        pass
    return getattr(settings, 'RAZORPAY_KEY_ID', ''), getattr(settings, 'RAZORPAY_KEY_SECRET', '')

def razorpay_configured():
    """Returns True only if real (non-placeholder) Razorpay credentials are available."""
    key_id, key_secret = _get_effective_razorpay_keys()
    if not key_id or not key_secret:
        return False
    if 'REPLACE_WITH' in key_secret or 'dummy' in key_id or 'dummy' in key_secret:
        return False
    return True

def get_razorpay_client():
    """Returns a fresh Razorpay client using the most up-to-date credentials."""
    key_id, key_secret = _get_effective_razorpay_keys()
    if not key_id or not key_secret:
        return None
    try:
        return razorpay.Client(auth=(key_id, key_secret))
    except Exception:
        return None

class InitiateUnlockView(views.APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = 'unlock_initiate'

    def post(self, request, id):
        try:
            prop = Property.objects.get(id=id)
            if prop.status == 'under_negotiation':
                from datetime import timedelta
                if prop.under_negotiation_since and (timezone.now() - prop.under_negotiation_since) > timedelta(hours=48):
                    prop.status = 'live'
                    prop.under_negotiation_since = None
                    prop.save(update_fields=['status', 'under_negotiation_since'])
                else:
                    return Response({'detail': 'This property is currently under negotiation. Contact unlocks are temporarily paused for 48 hours to protect your payment.'}, status=status.HTTP_400_BAD_REQUEST)

            if prop.status != 'live':
                return Response({'detail': 'Property is not available for unlocks.'}, status=status.HTTP_400_BAD_REQUEST)
        except Property.DoesNotExist:
            return Response({'detail': 'Property not found.'}, status=status.HTTP_404_NOT_FOUND)

        buyer_user = request.user
        user_roles = buyer_user.roles if isinstance(buyer_user.roles, list) else [str(buyer_user.roles)]
        is_staff_role = any(r in ['admin', 'sub_admin', 'subadmin', 'agent'] for r in user_roles)
        if is_staff_role and 'buyer' not in user_roles:
            return Response({'detail': 'Admin, Sub-Admin, and Field Agent accounts are internal staff accounts and cannot unlock properties as buyers.'}, status=status.HTTP_403_FORBIDDEN)

        # Expire stale pending orders older than 15 minutes to prevent blocking retries
        from datetime import timedelta
        stale_cutoff = timezone.now() - timedelta(minutes=15)
        Unlock.objects.filter(buyer=buyer_user, property=prop, status='pending', created_at__lt=stale_cutoff).update(status='failed')

        # Check if property is already unlocked by this buyer
        existing_paid = Unlock.objects.filter(buyer=buyer_user, property=prop, status='paid').first()
        if existing_paid:
            return Response({
                'instant_unlocked': True,
                'detail': 'Property is already unlocked!',
                'exact_lat': prop.exact_lat,
                'exact_lng': prop.exact_lng,
                'owner_name': prop.owner_name,
                'owner_phone': prop.owner_phone,
                'unlock_id': existing_paid.id
            })

        try:
            # 1-Click Instant Unlock Check using Pass Credits
            with transaction.atomic():
                active_sub = BuyerSubscription.objects.select_for_update().filter(
                    buyer=buyer_user,
                    status='active',
                    credits_remaining__gt=0
                ).order_by('created_at').first()

                if active_sub:
                    active_sub.credits_remaining -= 1
                    if active_sub.credits_remaining == 0:
                        active_sub.status = 'depleted'
                    active_sub.save(update_fields=['credits_remaining', 'status'])

                    unlock, created = Unlock.objects.get_or_create(
                        buyer=buyer_user,
                        property=prop,
                        defaults={
                            'amount': 0.00,
                            'status': 'paid',
                            'payment_method': 'razorpay',
                            'unlocked_at': timezone.now()
                        }
                    )
                    if not created:
                        unlock.status = 'paid'
                        unlock.amount = 0.00
                        unlock.unlocked_at = timezone.now()
                        unlock.save()

                return Response({
                    'instant_unlocked': True,
                    'detail': 'Property unlocked instantly using your pass credit!',
                    'exact_lat': prop.exact_lat,
                    'exact_lng': prop.exact_lng,
                    'owner_name': prop.owner_name,
                    'owner_phone': prop.owner_phone,
                    'unlock_id': unlock.id,
                    'credits_remaining': active_sub.credits_remaining
                })
        except IntegrityError:
            return Response({'detail': 'An order for this property is already in progress. Please complete your transaction or retry in a few moments.'}, status=status.HTTP_409_CONFLICT)

        from properties.models import PlatformSettings
        ps = PlatformSettings.load()

        # Check payment bypass mode (only bypass if explicitly enabled by admin)
        if ps.bypass_buyer_payment:
            unlock, _ = Unlock.objects.get_or_create(
                buyer=buyer_user,
                property=prop,
                defaults={
                    'amount': 0.00,
                    'status': 'paid',
                    'payment_method': 'razorpay',
                    'unlocked_at': timezone.now()
                }
            )
            if unlock.status != 'paid':
                unlock.status = 'paid'
                unlock.unlocked_at = timezone.now()
                unlock.save()

            return Response({
                'instant_unlocked': True,
                'detail': 'Property unlocked instantly!',
                'exact_lat': prop.exact_lat,
                'exact_lng': prop.exact_lng,
                'owner_name': prop.owner_name,
                'owner_phone': prop.owner_phone,
                'unlock_id': unlock.id
            })

        unlock_price = float(ps.buyer_unlock_fee)
        amount = int(unlock_price * 100)
        currency = 'INR'

        if getattr(ps, 'buyer_payment_gateway', 'razorpay') == 'upi':
            Unlock.objects.create(
                buyer=buyer_user,
                property=prop,
                amount=unlock_price,
                status='pending',
                payment_method='upi'
            )
            return Response({
                'payment_gateway': 'upi',
                'amount': unlock_price,
                'upi_merchant_id': ps.default_upi_id or 'merchant@upi'
            })

        if not razorpay_configured():
            return Response(
                {'detail': 'Payment gateway is not configured or credentials are invalid. Please contact the support team.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            # Create Razorpay order using the most current credentials (DB preferred over env)
            effective_client = get_razorpay_client()
            effective_key_id, _ = _get_effective_razorpay_keys()
            razorpay_order = effective_client.order.create(dict(amount=amount, currency=currency, payment_capture='1'))
            order_id = razorpay_order['id']

            # Tightly scoped DB insert with IntegrityError handling
            try:
                Unlock.objects.create(
                    buyer=buyer_user,
                    property=prop,
                    amount=unlock_price,
                    order_id=order_id,
                    status='pending',
                    payment_method='razorpay'
                )
            except IntegrityError:
                return Response({'detail': 'An order for this property is already in progress. Please complete your transaction or retry in a few moments.'}, status=status.HTTP_409_CONFLICT)

            return Response({
                'payment_gateway': 'razorpay',
                'order_id': order_id,
                'amount': amount,
                'key_id': effective_key_id,
                'razorpay_key_id': effective_key_id,
                'buyer_name': request.user.username,
                'buyer_phone': getattr(request.user, 'phone', ''),
                'currency': currency
            })
        except Exception as e:
            logger.error(f"Failed to initiate Razorpay order for user {request.user.id}, property {id}", exc_info=True)
            return Response({
                'detail': 'Payment gateway configuration error. Please contact the support team.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VerifyUnlockView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        payment_method = request.data.get('payment_method', 'razorpay')
        
        if payment_method == 'upi':
            utr = request.data.get('utr')
            property_id = request.data.get('property_id')
            if not utr or not property_id:
                return Response({'detail': 'UTR and property_id required.'}, status=status.HTTP_400_BAD_REQUEST)
                
            try:
                unlock = Unlock.objects.filter(buyer=request.user, property_id=property_id, status='pending', payment_method='upi').latest('id')
                unlock.utr = utr
                unlock.status = 'paid'
                unlock.unlocked_at = timezone.now()
                unlock.save()
                
                prop = Property.objects.get(id=property_id)
                return Response({
                    'detail': 'Payment submitted and instantly verified!',
                    'exact_lat': prop.exact_lat,
                    'exact_lng': prop.exact_lng,
                    'owner_name': prop.owner.username if prop.owner else 'Owner',
                    'owner_phone': getattr(prop.owner, 'phone_number', 'N/A') if prop.owner else 'N/A',
                    'unlock_id': unlock.id
                })
            except Unlock.DoesNotExist:
                return Response({'detail': 'Pending unlock not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not razorpay_client:
            return Response({'detail': 'Razorpay not configured on server.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_signature = request.data.get('razorpay_signature')

        if not all([razorpay_payment_id, razorpay_order_id, razorpay_signature]):
            return Response({'detail': 'Missing payment verification details.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify Signature
        try:
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            razorpay_client.utility.verify_payment_signature(params_dict)
        except razorpay.errors.SignatureVerificationError:
            return Response({'detail': 'Invalid payment signature.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            prop = Property.objects.get(id=id, status__in=['live', 'under_negotiation'])
        except Property.DoesNotExist:
            return Response({'detail': 'Property not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                # Lock the unlock row to prevent race conditions (in case webhook arrives simultaneously)
                unlock = Unlock.objects.select_for_update().get(
                    buyer=request.user, 
                    property=prop, 
                    order_id=razorpay_order_id, 
                    status='pending'
                )
                unlock.status = 'paid'
                unlock.gateway_txn_id = razorpay_payment_id
                unlock.unlocked_at = timezone.now()
                unlock.save()
                
                # Create system notification for unlock success
                from notifications.models import Notification
                Notification.objects.create(
                    recipient=request.user,
                    message=f"Property unlocked successfully! Contact details for property #{prop.id} are now visible.",
                    property=prop
                )

                # Create system notification for owner/agent (new lead)
                lead_recipient = prop.owner or prop.agent
                if lead_recipient:
                    Notification.objects.create(
                        recipient=lead_recipient,
                        message=f"🔥 New Lead: A buyer has unlocked contact details for your property {prop.property_type.replace('_', ' ').capitalize()} in {prop.locality.name if prop.locality else ''}!",
                        property=prop
                    )
                # NOTE: Property stays 'live' — owner manually triggers Under Negotiation
                # when they are actually in talks with this buyer.

                # Auto-create earnings
                if prop.agent and prop.locality and prop.locality.city:
                    from earnings.models import CommissionRule, EarningEntry
                    
                    rule = CommissionRule.objects.filter(
                        agent=prop.agent, 
                        city=prop.locality.city, 
                        rule_type__in=['percent_per_unlock', 'flat_per_unlock'], 
                        is_active=True
                    ).first()
                    
                    if not rule:
                        rule = CommissionRule.objects.filter(
                            agent__isnull=True, 
                            city=prop.locality.city, 
                            rule_type__in=['percent_per_unlock', 'flat_per_unlock'], 
                            is_active=True
                        ).first()
                    
                    if rule:
                        amount = rule.amount_or_percent
                        if rule.rule_type == 'percent_per_unlock':
                            amount = (unlock.amount * rule.amount_or_percent) / 100
                            
                        EarningEntry.objects.create(
                            agent=prop.agent,
                            property=prop,
                            source_type='unlock_generated',
                            amount=amount,
                            status='pending'
                        )

        except Unlock.DoesNotExist:
            # Maybe it was already paid by the webhook, which is fine
            unlock = Unlock.objects.filter(buyer=request.user, property=prop, order_id=razorpay_order_id, status='paid').first()
            if not unlock:
                return Response({'detail': 'Unlock record not found or already verified.'}, status=status.HTTP_404_NOT_FOUND)

        # Return full details now that it's verified
        return Response({
            'exact_lat': prop.exact_lat,
            'exact_lng': prop.exact_lng,
            'owner_name': prop.owner_name,
            'owner_phone': prop.owner_phone,
            'unlock_id': unlock.id
        })

import time
from django.core.cache import cache

class RazorpayWebhookView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        payload_body = request.body.decode('utf-8')
        webhook_signature = request.headers.get('x-razorpay-signature')

        if not webhook_signature:
            return Response({'detail': 'Missing signature'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Verify HMAC SHA-256 signature over raw request body
        try:
            razorpay_client.utility.verify_webhook_signature(payload_body, webhook_signature, settings.RAZORPAY_WEBHOOK_SECRET)
        except razorpay.errors.SignatureVerificationError:
            security_logger.warning(f"Webhook signature verification failed for signature: {webhook_signature}")
            return Response({'detail': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)

        payload = request.data
        payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
        payment_id = payment_entity.get('id')
        order_id = payment_entity.get('order_id')
        event_type = payload.get('event', 'payment.captured')

        # 2. DB-level idempotency — persists beyond Redis cache TTL
        from .models import ProcessedWebhookEvent
        event_id = payload.get('id') or payment_id or order_id
        if event_id:
            _, created = ProcessedWebhookEvent.objects.get_or_create(
                event_id=event_id,
                defaults={'event_type': event_type}
            )
            if not created:
                security_logger.info(f"Duplicate webhook ignored: {event_type} / {event_id}")
                return Response({'detail': 'Already processed'}, status=status.HTTP_200_OK)

        # 3. Replay Check A: Event Timestamp from INSIDE signed payload body (not unsigned headers)
        event_created_at = payload.get('created_at') or payment_entity.get('created_at')
        if event_created_at:
            try:
                if abs(time.time() - float(event_created_at)) > 300:
                    security_logger.warning(f"Expired webhook payload timestamp: {event_created_at}")
                    return Response({'detail': 'Webhook timestamp expired'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                pass

        # 4. Replay Check B: Atomic TOCTOU-safe deduplication via cache
        dedup_key = payment_id or order_id
        if dedup_key:
            cache_key = f"razorpay_webhook_txn:{event_type}:{dedup_key}"
            is_new_event = cache.add(cache_key, True, timeout=86400)
            if not is_new_event:
                return Response({'detail': 'Transaction already processed'}, status=status.HTTP_200_OK)

        if payload.get('event') == 'payment.captured':
            if order_id:
                try:
                    with transaction.atomic():
                        # Lock the unlock row to prevent race conditions
                        unlock = Unlock.objects.select_for_update().get(order_id=order_id, status='pending')
                        unlock.status = 'paid'
                        unlock.gateway_txn_id = payment_id
                        unlock.unlocked_at = timezone.now()
                        unlock.save()
                        # NOTE: Property stays 'live' — owner manually triggers Under Negotiation.
                        prop = unlock.property

                        # Create system notification for unlock success
                        from notifications.models import Notification
                        Notification.objects.create(
                            recipient=unlock.buyer,
                            message=f"Property unlocked successfully! Contact details for property #{prop.id} are now visible.",
                            property=prop
                        )

                        # Create system notification for owner/agent (new lead)
                        lead_recipient = prop.owner or prop.agent
                        if lead_recipient:
                            Notification.objects.create(
                                recipient=lead_recipient,
                                message=f"🔥 New Lead: A buyer has unlocked contact details for your property {prop.property_type.replace('_', ' ').capitalize()} in {prop.locality.name if prop.locality else ''}!",
                                property=prop
                            )

                        # Auto-create earnings
                        prop = unlock.property
                        if prop.agent and prop.locality and prop.locality.city:
                            from earnings.models import CommissionRule, EarningEntry
                            
                            rule = CommissionRule.objects.filter(
                                agent=prop.agent, 
                                city=prop.locality.city, 
                                rule_type__in=['percent_per_unlock', 'flat_per_unlock'], 
                                is_active=True
                            ).first()
                            
                            if not rule:
                                rule = CommissionRule.objects.filter(
                                    agent__isnull=True, 
                                    city=prop.locality.city, 
                                    rule_type__in=['percent_per_unlock', 'flat_per_unlock'], 
                                    is_active=True
                                ).first()
                            
                            if rule:
                                amount = rule.amount_or_percent
                                if rule.rule_type == 'percent_per_unlock':
                                    amount = (unlock.amount * rule.amount_or_percent) / 100
                                    
                                EarningEntry.objects.create(
                                    agent=prop.agent,
                                    property=prop,
                                    source_type='unlock_generated',
                                    amount=amount,
                                    status='pending'
                                )

                except Unlock.DoesNotExist:
                    # Ignore duplicate webhooks or already paid unlocks
                    pass

        return Response(status=status.HTTP_200_OK)

class PropertyFullDetailsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        try:
            prop = Property.objects.get(id=id)
        except Property.DoesNotExist:
            return Response({'detail': 'Property not found'}, status=status.HTTP_404_NOT_FOUND)

        roles = request.user.roles if hasattr(request.user, 'roles') else [request.user.role]
        is_staff_or_owner = any(r in ['admin', 'moderator', 'agent'] for r in roles) or prop.owner == request.user

        if not is_staff_or_owner:
            # Check if unlocked by this buyer
            unlock = Unlock.objects.filter(buyer=request.user, property=prop, status='paid').order_by('-unlocked_at').first()
            if not unlock:
                return Response({'detail': 'Not unlocked'}, status=status.HTTP_403_FORBIDDEN)
            unlock_id = unlock.id
        else:
            unlock_id = None

        return Response({
            'exact_lat': prop.exact_lat,
            'exact_lng': prop.exact_lng,
            'owner_name': prop.owner_name,
            'owner_phone': prop.owner_phone,
            'unlock_id': unlock_id
        })

class MyUnlocksView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PropertySerializer

    def get_queryset(self):
        # Fetch properties where the user has a paid Unlock row
        unlocked_property_ids = Unlock.objects.filter(buyer=self.request.user, status='paid').values_list('property_id', flat=True)
        return Property.objects.filter(id__in=unlocked_property_ids).order_by('-created_at')

from .models import Feedback
from django.db import IntegrityError

class SubmitFeedbackView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        try:
            unlock = Unlock.objects.get(id=id, buyer=request.user, status='paid')
        except Unlock.DoesNotExist:
            return Response({'detail': 'Unlock not found or not paid'}, status=status.HTTP_404_NOT_FOUND)

        is_accurate = request.data.get('is_accurate')
        if is_accurate is None:
            return Response({'detail': 'is_accurate field is required'}, status=status.HTTP_400_BAD_REQUEST)

        note = request.data.get('note', '')

        try:
            Feedback.objects.create(
                unlock=unlock,
                buyer=request.user,
                is_accurate=bool(is_accurate),
                note=note
            )
            return Response({'detail': 'Feedback submitted successfully'})
        except IntegrityError:
            return Response({'detail': 'Feedback already submitted for this unlock'}, status=status.HTTP_400_BAD_REQUEST)

from accounts.permissions import IsAdminOrModerator
from rest_framework import serializers

class AdminUnlockSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.username', read_only=True)
    buyer_role = serializers.CharField(source='buyer.role', read_only=True, default='buyer')
    buyer_full_name = serializers.SerializerMethodField()
    buyer_is_active = serializers.BooleanField(source='buyer.is_active', read_only=True)
    
    property_id = serializers.IntegerField(source='property.id', read_only=True)
    property_title = serializers.CharField(source='property.title', read_only=True)
    property_owner_username = serializers.CharField(source='property.owner.username', read_only=True, default='')
    property_owner_fullname = serializers.SerializerMethodField()
    property_owner_is_active = serializers.BooleanField(source='property.owner.is_active', read_only=True, default=True)

    class Meta:
        model = Unlock
        fields = [
            'id', 'buyer_name', 'buyer_role', 'buyer_full_name', 'buyer_is_active',
            'property_id', 'property_title', 'property_owner_username', 'property_owner_fullname',
            'property_owner_is_active', 'amount', 'payment_method', 'utr', 'status', 'unlocked_at'
        ]

    def get_buyer_full_name(self, obj):
        full_name = obj.buyer.get_full_name()
        return full_name if full_name else 'Unknown Name'

    def get_property_owner_fullname(self, obj):
        if obj.property and obj.property.owner:
            fn = obj.property.owner.get_full_name()
            return fn if fn else obj.property.owner.username
        return ''

class AdminUnlockListView(generics.ListAPIView):
    permission_classes = [IsAdminOrModerator]
    serializer_class = AdminUnlockSerializer

    def get_queryset(self):
        return Unlock.objects.exclude(payment_method='razorpay').order_by('-id')

class AdminCreateManualTransactionView(views.APIView):
    """Allows Admin to record and immediately approve a manual transaction."""
    permission_classes = [IsAdminOrModerator]

    def post(self, request):
        user_identifier = request.data.get('user')
        property_id = request.data.get('property_id')
        amount = request.data.get('amount', 0)
        payment_method = request.data.get('payment_method', 'cash')
        utr = request.data.get('utr') or f"ADMIN_MANUAL_{timezone.now().strftime('%Y%m%d%H%M%S')}"

        if not user_identifier:
            return Response({'detail': 'User (username, phone, or ID) is required.'}, status=400)

        user_qs = User.objects.filter(
            models.Q(username=user_identifier) | 
            models.Q(phone=user_identifier) | 
            models.Q(id=int(user_identifier) if str(user_identifier).isdigit() else -1)
        )
        if not user_qs.exists():
            return Response({'detail': f'User "{user_identifier}" not found.'}, status=404)
        target_user = user_qs.first()

        prop = None
        if property_id:
            try:
                prop = Property.objects.get(id=property_id)
            except Property.DoesNotExist:
                return Response({'detail': f'Property #{property_id} not found.'}, status=404)

        from decimal import Decimal
        unlock = Unlock.objects.create(
            buyer=target_user,
            property=prop,
            amount=Decimal(str(amount)) if amount else Decimal('0.00'),
            payment_method=payment_method,
            utr=utr,
            status='paid',
            unlocked_at=timezone.now()
        )

        return Response({
            'detail': f'Manual transaction #{unlock.id} created and approved for {target_user.username}.',
            'id': unlock.id,
            'user': target_user.username,
            'amount': float(unlock.amount),
            'payment_method': unlock.payment_method,
            'utr': unlock.utr,
            'status': unlock.status
        })

class AdminUnlockActionView(views.APIView):
    permission_classes = [IsAdminOrModerator]

    def patch(self, request, id):
        action = request.data.get('action')
        try:
            unlock = Unlock.objects.get(id=id)
        except Unlock.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
            
        if action == 'approve':
            unlock.status = 'paid'
            unlock.unlocked_at = timezone.now()
            unlock.save()
            return Response({'detail': 'Approved'})
        elif action == 'reject':
            unlock.status = 'failed'
            unlock.save()
            return Response({'detail': 'Rejected'})
        elif action == 'ban':
            unlock.status = 'failed'
            unlock.save()
            
            # Ban the user who initiated the transaction
            user = unlock.buyer
            user.is_active = False
            user.save()
            
            # If a property is associated with this transaction, unapprove it
            if unlock.property:
                unlock.property.is_approved = False
                unlock.property.save()

            return Response({'detail': f'User "{user.username}" ({user.role}) Banned & Access Revoked.'})
        elif action == 'unban':
            user = unlock.buyer
            user.is_active = True
            user.save()
            return Response({'detail': f'User "{user.username}" Unbanned Successfully.'})
        return Response({'detail': 'Invalid action'}, status=400)


class AdminFeedbackSerializer(serializers.ModelSerializer):
    buyer_name = serializers.SerializerMethodField()
    buyer_phone = serializers.CharField(source='buyer.phone', read_only=True)
    property_id = serializers.IntegerField(source='unlock.property.id', read_only=True)
    property_title = serializers.SerializerMethodField()
    owner_phone = serializers.CharField(source='unlock.property.owner_phone', read_only=True)

    class Meta:
        model = Feedback
        fields = ['id', 'buyer_name', 'buyer_phone', 'property_id', 'property_title', 'owner_phone', 'is_accurate', 'note', 'created_at']

    def get_buyer_name(self, obj):
        if not obj.buyer:
            return "Guest Buyer"
        full_name = obj.buyer.get_full_name().strip()
        if full_name:
            return full_name
        if obj.buyer.first_name and obj.buyer.first_name.strip():
            return obj.buyer.first_name.strip()
        username = obj.buyer.username
        if username.startswith("buyer_") or username.startswith("owner_") or username.startswith("user_"):
            return "Verified Buyer"
        return username

    def get_property_title(self, obj):
        if not obj.unlock or not obj.unlock.property:
            return "Property Listing"
        prop = obj.unlock.property
        locality_name = prop.locality.name if prop.locality else ""
        city_name = prop.locality.city.name if prop.locality and prop.locality.city else ""
        type_title = prop.get_property_type_display() if hasattr(prop, 'get_property_type_display') else str(prop.property_type).replace('_', ' ').title()
        bhk = f"{prop.bedrooms} BHK " if prop.bedrooms else ""
        location = f" in {locality_name}" if locality_name else f" in {city_name}" if city_name else ""
        return f"{bhk}{type_title}{location}"


class AdminFeedbackListView(generics.ListAPIView):
    permission_classes = [IsAdminOrModerator]
    serializer_class = AdminFeedbackSerializer

    def get_queryset(self):
        return Feedback.objects.select_related('buyer', 'unlock__property__locality__city').order_by('-id')


from .models import BuyerSubscription

class MySubscriptionView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sub = BuyerSubscription.objects.filter(
            buyer=request.user,
            status='active',
            credits_remaining__gt=0
        ).order_by('-created_at').first()

        if not sub:
            return Response({
                'has_active_pass': False,
                'credits_remaining': 0,
                'agreement_credits_remaining': 0
            })

        return Response({
            'has_active_pass': True,
            'pass_type': sub.pass_type,
            'credits_remaining': sub.credits_remaining,
            'agreement_credits_remaining': sub.agreement_credits_remaining,
            'expires_at': None,
            'extension_used': False
        })

def activate_or_stack_buyer_pass(buyer_user, pass_type, amount_paid=None, order_id=None, gateway_txn_id=None):
    from properties.models import PlatformSettings
    ps = PlatformSettings.load()

    PASS_PRICING = {
        'single_14': {'price': float(ps.buyer_unlock_fee), 'credits': 1, 'agreements': 0},
        'starter_39': {'price': float(ps.buyer_pass_starter_price), 'credits': 3, 'agreements': 0},
        'smart_79': {'price': float(ps.buyer_pass_smart_price), 'credits': 6, 'agreements': 1},
        'pro_129': {'price': float(ps.buyer_pass_pro_price), 'credits': 10, 'agreements': 3},
    }

    config = PASS_PRICING.get(pass_type, PASS_PRICING['starter_39'])

    active_sub = BuyerSubscription.objects.filter(
        buyer=buyer_user,
        status='active',
        credits_remaining__gt=0
    ).order_by('-created_at').first()

    if active_sub:
        # Credit Stacking Engine: Stack credits indefinitely without time expiration
        active_sub.credits_remaining += config['credits']
        active_sub.agreement_credits_remaining += config['agreements']
        active_sub.pass_type = pass_type
        if order_id:
            active_sub.order_id = order_id
        if gateway_txn_id:
            active_sub.gateway_txn_id = gateway_txn_id
        active_sub.save()
        return active_sub, True
    else:
        sub = BuyerSubscription.objects.create(
            buyer=buyer_user,
            pass_type=pass_type,
            amount_paid=amount_paid or config['price'],
            credits_remaining=config['credits'],
            agreement_credits_remaining=config['agreements'],
            order_id=order_id,
            gateway_txn_id=gateway_txn_id,
            status='active',
            expires_at=None
        )
        return sub, False


class InitiatePassPurchaseView(views.APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = 'pass_initiate'

    def post(self, request):
        pass_type = request.data.get('pass_type', 'starter_39')
        
        from properties.models import PlatformSettings
        ps = PlatformSettings.load()

        PASS_PRICING = {
            'single_14': {'price': float(ps.buyer_unlock_fee), 'credits': 1, 'agreements': 0, 'days': 1},
            'starter_39': {'price': float(ps.buyer_pass_starter_price), 'credits': 3, 'agreements': 0, 'days': 15},
            'smart_79': {'price': float(ps.buyer_pass_smart_price), 'credits': 6, 'agreements': 1, 'days': 30},
            'pro_129': {'price': float(ps.buyer_pass_pro_price), 'credits': 10, 'agreements': 3, 'days': 45},
        }

        if pass_type not in PASS_PRICING:
            return Response({'detail': 'Invalid pass selected.'}, status=status.HTTP_400_BAD_REQUEST)

        # Expire stale pending pass purchases older than 15 minutes to prevent blocking retries
        from datetime import timedelta
        stale_cutoff = timezone.now() - timedelta(minutes=15)
        BuyerSubscription.objects.filter(
            buyer=request.user,
            pass_type=pass_type,
            status='pending',
            created_at__lt=stale_cutoff
        ).update(status='expired')

        config = PASS_PRICING[pass_type]

        if ps.bypass_buyer_payment:
            sub, is_stacked = activate_or_stack_buyer_pass(request.user, pass_type, config['price'])
            return Response({
                'bypassed': True,
                'is_stacked': is_stacked,
                'detail': f"Pass {'stacked' if is_stacked else 'activated'} instantly! Total credits: {sub.credits_remaining}",
                'pass_type': pass_type,
                'credits_remaining': sub.credits_remaining
            })

        if getattr(ps, 'buyer_payment_gateway', 'razorpay') == 'upi':
            sub = BuyerSubscription.objects.create(
                buyer=request.user,
                pass_type=pass_type,
                amount_paid=config['price'],
                status='pending',
                payment_method='upi'
            )
            return Response({
                'payment_gateway': 'upi',
                'amount': config['price'],
                'upi_merchant_id': ps.default_upi_id or 'merchant@upi',
                'pass_type': pass_type
            })

        if not razorpay_configured():
            return Response({'detail': 'Payment gateway is not configured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        amount = int(config['price'] * 100)

        try:
            order = razorpay_client.order.create({
                'amount': amount,
                'currency': 'INR',
                'payment_capture': '1',
                'notes': {
                    'buyer_id': str(request.user.id),
                    'pass_type': pass_type
                }
            })

            return Response({
                'order_id': order['id'],
                'amount': amount,
                'key_id': settings.RAZORPAY_KEY_ID,
                'pass_type': pass_type,
                'price': config['price']
            })
        except IntegrityError:
            return Response({'detail': 'A pass purchase order is already in progress. Please complete your transaction or retry in a few moments.'}, status=status.HTTP_409_CONFLICT)
        except Exception as e:
            logger.error(f"Pass purchase initiation failed for user {request.user.id}", exc_info=True)
            return Response({
                'detail': f'Failed to initiate Razorpay order: {str(e)}. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VerifyPassPurchaseView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payment_method = request.data.get('payment_method', 'razorpay')
        pass_type = request.data.get('pass_type', 'starter_39')

        if payment_method == 'upi':
            utr = request.data.get('utr')
            if not utr:
                return Response({'detail': 'UTR number is required for UPI payments.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                sub = BuyerSubscription.objects.filter(
                    buyer=request.user, 
                    pass_type=pass_type, 
                    status='pending', 
                    payment_method='upi'
                ).latest('id')
                
                from properties.models import PlatformSettings
                ps = PlatformSettings.load()
                PASS_PRICING = {
                    'single_14': {'price': float(ps.buyer_unlock_fee), 'credits': 1, 'agreements': 0, 'days': 1},
                    'starter_39': {'price': float(ps.buyer_pass_starter_price), 'credits': 3, 'agreements': 0, 'days': 15},
                    'smart_79': {'price': float(ps.buyer_pass_smart_price), 'credits': 6, 'agreements': 1, 'days': 30},
                    'pro_129': {'price': float(ps.buyer_pass_pro_price), 'credits': 10, 'agreements': 3, 'days': 45},
                }
                config = PASS_PRICING[pass_type]
                
                # Instantly activate based on user preference for MVP
                sub.utr = utr
                sub.status = 'active'
                sub.credits_remaining = config['credits']
                sub.agreement_credits_remaining = config['agreements']
                from datetime import timedelta
                sub.expires_at = timezone.now() + timedelta(days=config['days'])
                sub.save()
                
                return Response({
                    'detail': 'Pass activated successfully via UPI!',
                    'credits_remaining': sub.credits_remaining
                })
            except BuyerSubscription.DoesNotExist:
                return Response({'detail': 'No pending pass purchase found.'}, status=status.HTTP_404_NOT_FOUND)

        if not razorpay_client:
            return Response({'detail': 'Razorpay not configured on server.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_signature = request.data.get('razorpay_signature')

        if not all([razorpay_payment_id, razorpay_order_id, razorpay_signature]):
            return Response({'detail': 'Missing payment verification details.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            razorpay_client.utility.verify_payment_signature({
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            })
        except razorpay.errors.SignatureVerificationError:
            return Response({'detail': 'Invalid payment signature.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if transaction already processed to prevent credit stacking exploit
        if BuyerSubscription.objects.filter(gateway_txn_id=razorpay_payment_id).exists():
            return Response({'detail': 'This transaction has already been credited.'}, status=status.HTTP_400_BAD_REQUEST)

        from properties.models import PlatformSettings
        ps = PlatformSettings.load()

        PASS_PRICING = {
            'single_14': {'price': float(ps.buyer_unlock_fee), 'credits': 1, 'agreements': 0, 'days': 1},
            'starter_39': {'price': float(ps.buyer_pass_starter_price), 'credits': 3, 'agreements': 0, 'days': 15},
            'smart_79': {'price': float(ps.buyer_pass_smart_price), 'credits': 6, 'agreements': 1, 'days': 30},
            'pro_129': {'price': float(ps.buyer_pass_pro_price), 'credits': 10, 'agreements': 3, 'days': 45},
        }

        config = PASS_PRICING.get(pass_type, PASS_PRICING['starter_39'])
        sub, is_stacked = activate_or_stack_buyer_pass(
            request.user, 
            pass_type, 
            config['price'], 
            order_id=razorpay_order_id, 
            gateway_txn_id=razorpay_payment_id
        )

        # Create system notification for pass purchase success
        from notifications.models import Notification
        Notification.objects.create(
            recipient=request.user,
            message=f"Payment verified! Your buyer credit pass '{pass_type}' is now active with {sub.credits_remaining} credits."
        )

        return Response({
            'detail': 'Pass stacked and activated successfully!' if is_stacked else 'Pass activated successfully!',
            'credits_remaining': sub.credits_remaining,
            'agreement_credits_remaining': sub.agreement_credits_remaining,
            'expires_at': sub.expires_at,
            'is_stacked': is_stacked
        })

class ExtendPassValidityView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from datetime import timedelta
        sub = BuyerSubscription.objects.filter(
            buyer=request.user,
            status='active'
        ).order_by('-created_at').first()

        if not sub:
            return Response({'detail': 'No active pass found.'}, status=status.HTTP_404_NOT_FOUND)

        if sub.extension_used:
            return Response({'detail': 'Free extension already used for this pass.'}, status=status.HTTP_400_BAD_REQUEST)

        sub.expires_at = (sub.expires_at or timezone.now()) + timedelta(days=15)
        sub.extension_used = True
        sub.save(update_fields=['expires_at', 'extension_used'])

        return Response({
            'detail': 'Validity extended by 15 days for free!',
            'expires_at': sub.expires_at
        })


from accounts.permissions import IsAdminOrModerator

class InitiateRefundView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdminOrModerator]

    def post(self, request, id):
        try:
            unlock = Unlock.objects.get(id=id)
        except Unlock.DoesNotExist:
            return Response({'detail': 'Unlock record not found.'}, status=status.HTTP_404_NOT_FOUND)

        if unlock.status != 'paid':
            return Response({'detail': 'Only paid unlocks can be refunded.'}, status=status.HTTP_400_BAD_REQUEST)

        if not unlock.gateway_txn_id:
            return Response({'detail': 'Cannot refund an unlock that has no gateway transaction ID.'}, status=status.HTTP_400_BAD_REQUEST)

        if not razorpay_client:
            return Response({'detail': 'Razorpay client is not configured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            # Initiate Razorpay refund
            refund_amount_paise = int(unlock.amount * 100)
            refund_response = razorpay_client.payment.refund(
                unlock.gateway_txn_id,
                {
                    'amount': refund_amount_paise,
                    'notes': {
                        'unlock_id': str(unlock.id),
                        'refunded_by': str(request.user.id)
                    }
                }
            )
            
            # Update unlock status to refunded
            unlock.status = 'refunded'
            unlock.save(update_fields=['status'])

            # Log the audit message
            audit_logger = logging.getLogger('audit')
            audit_logger.info(f"Refund initiated for unlock {unlock.id} (Transaction: {unlock.gateway_txn_id}) by user {request.user.username} (ID: {request.user.id}). Razorpay Refund ID: {refund_response.get('id')}")

            return Response({
                'detail': 'Refund initiated successfully via Razorpay.',
                'refund_id': refund_response.get('id'),
                'status': 'refunded'
            })
        except Exception as e:
            logger.error(f"Razorpay refund failed for unlock {unlock.id}: {str(e)}", exc_info=True)
            return Response({
                'detail': f'Razorpay refund initiation failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GenerateReceiptView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, txn_id):
        from unlocks.models import Unlock, BuyerSubscription, OwnerListingPass
        from django.http import HttpResponse

        # 1. Search across transactions
        item = None
        txn_type = ""
        description = ""
        date = None
        amount = 0
        user = None

        unlock = Unlock.objects.filter(gateway_txn_id=txn_id).first()
        if unlock:
            if unlock.buyer != request.user and not request.user.is_staff:
                return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
            item = unlock
            txn_type = "Property Contact Unlock"
            description = f"Contact unlock for Property #{unlock.property.id}"
            date = unlock.unlocked_at or unlock.created_at
            amount = unlock.amount
            user = unlock.buyer
        else:
            sub = BuyerSubscription.objects.filter(gateway_txn_id=txn_id).first()
            if sub:
                if sub.buyer != request.user and not request.user.is_staff:
                    return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
                item = sub
                txn_type = "Buyer Credit Pass"
                description = f"Refill Pass: {sub.get_pass_type_display()}"
                date = sub.created_at
                amount = sub.amount_paid
                user = sub.buyer
            else:
                owner_pass = OwnerListingPass.objects.filter(gateway_txn_id=txn_id).first()
                if owner_pass:
                    if owner_pass.owner != request.user and not request.user.is_staff:
                        return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
                    item = owner_pass
                    txn_type = "Owner Listing Pass"
                    description = f"Refill Pass: {owner_pass.plan_id} ({owner_pass.credits_total} Listing Credits)"
                    date = owner_pass.created_at
                    amount = owner_pass.amount_paid
                    user = owner_pass.owner

        if not item:
            return Response({'detail': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        formatted_date = date.strftime('%B %d, %Y %I:%M %p') if date else "N/A"

        # Build a beautiful, print-ready HTML Invoice
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Invoice - {txn_id}</title>
            <style>
                body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 40px; line-height: 1.6; background-color: #fafafa; }}
                .invoice-box {{ max-width: 800px; margin: auto; padding: 40px; border: 1px solid #eee; box-shadow: 0 10px 25px rgba(0,0,0,0.05); background-color: #fff; border-radius: 20px; }}
                .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 30px; margin-bottom: 30px; }}
                .logo {{ font-size: 24px; font-weight: 800; color: #059669; text-decoration: none; display: flex; align-items: center; }}
                .invoice-title {{ font-size: 20px; font-weight: 800; text-transform: uppercase; tracking-wider: 1px; color: #0f172a; }}
                .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }}
                .info-section h4 {{ margin: 0 0 10px 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }}
                .info-section p {{ margin: 0; font-size: 14px; font-weight: 600; color: #0f172a; }}
                table {{ width: 100%; border-collapse: collapse; margin-bottom: 40px; }}
                th {{ text-align: left; padding: 15px; border-bottom: 2px solid #f1f5f9; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }}
                td {{ padding: 20px 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; }}
                .total-section {{ display: flex; justify-content: flex-end; margin-top: 30px; }}
                .total-box {{ border-top: 2px solid #059669; padding-top: 15px; width: 250px; text-align: right; }}
                .total-row {{ display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; }}
                .grand-total {{ font-size: 20px; font-weight: 800; color: #059669; margin-top: 10px; }}
                .footer {{ text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; padding-top: 30px; margin-top: 50px; }}
                .print-btn {{ display: block; width: 150px; margin: 30px auto 0 auto; padding: 10px 20px; background-color: #059669; color: white; text-align: center; border-radius: 10px; font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; border: none; }}
                @media print {{
                    body {{ background-color: #fff; padding: 0; }}
                    .invoice-box {{ border: none; box-shadow: none; padding: 0; }}
                    .print-btn {{ display: none; }}
                }}
            </style>
        </head>
        <body>
            <div class="invoice-box">
                <div class="header">
                    <div class="logo">Rentlo</div>
                    <div class="invoice-title">Tax Invoice / Receipt</div>
                </div>

                <div class="info-grid">
                    <div class="info-section">
                        <h4>Billed To</h4>
                        <p>{user.first_name or user.username}</p>
                        <p style="font-weight: 500; color: #64748b;">Phone: {user.phone or 'Verified User'}</p>
                    </div>
                    <div class="info-section" style="text-align: right;">
                        <h4>Invoice Details</h4>
                        <p>Transaction ID: {txn_id}</p>
                        <p style="font-weight: 500; color: #64748b;">Date: {formatted_date}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item Description</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{txn_type} — {description}</td>
                            <td style="text-align: right; font-weight: 600;">₹{amount}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="total-section">
                    <div class="total-box">
                        <div class="total-row" style="color: #64748b;">
                            <span>Subtotal:</span>
                            <span>₹{amount}</span>
                        </div>
                        <div class="total-row" style="color: #64748b;">
                            <span>GST (18%):</span>
                            <span>₹0.00 (Inclusive)</span>
                        </div>
                        <div class="total-row grand-total">
                            <span>Total Paid:</span>
                            <span>₹{amount}</span>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <p>Rentlo Technologies Private Limited</p>
                    <p style="font-size: 10px; margin-top: 5px;">This is a computer-generated document and requires no physical signature.</p>
                </div>
            </div>

            <button onclick="window.print()" class="print-btn">Print Invoice</button>
        </body>
        </html>
        """
        return HttpResponse(html_content, content_type="text/html")

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch

class OwnerListingPassReceiptView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        from .models import OwnerListingPass
        from django.http import HttpResponse
        
        try:
            listing_pass = OwnerListingPass.objects.get(id=id)
            if listing_pass.owner != request.user:
                return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
                
            from properties.models import PlatformSettings
            import urllib.request
            import tempfile
            import os
            from PIL import Image
            
            settings = PlatformSettings.load()
            
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="Receipt_{listing_pass.id}.pdf"'
            
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
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp:
                        tmp.write(raw_data)
                        tmp_path = tmp.name
                    
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
            p.drawRightString(width - 1 * inch, current_y, "Payment Receipt")
            
            current_y -= 0.6 * inch
            
            # Draw Company Name
            p.setFont("Helvetica-Bold", 12)
            p.drawString(1 * inch, current_y, settings.company_name)
            
            current_y -= 0.5 * inch
            
            p.setFont("Helvetica", 12)
            p.drawString(1 * inch, current_y, f"Pass ID: {listing_pass.id}")
            current_y -= 0.3 * inch
            p.drawString(1 * inch, current_y, f"Customer: {listing_pass.owner.get_full_name()} ({listing_pass.owner.username})")
            current_y -= 0.3 * inch
            p.drawString(1 * inch, current_y, f"Plan: {listing_pass.credits_total} Credit(s) Pass")
            current_y -= 0.3 * inch
            p.drawString(1 * inch, current_y, f"Total Amount Paid: INR {listing_pass.amount_paid}")
            current_y -= 0.3 * inch
            p.drawString(1 * inch, current_y, f"Status: {listing_pass.status.upper()}")
            
            if listing_pass.status == 'active' or listing_pass.status == 'depleted':
                current_y -= 0.3 * inch
                p.drawString(1 * inch, current_y, f"Paid On: {listing_pass.created_at.strftime('%Y-%m-%d %H:%M')}")
                
            if listing_pass.utr:
                current_y -= 0.3 * inch
                p.drawString(1 * inch, current_y, f"Transaction Ref (UTR): {listing_pass.utr}")
                
            p.line(1 * inch, current_y - 0.5 * inch, width - 1 * inch, current_y - 0.5 * inch)
            
            current_y -= 1 * inch
            p.setFont("Helvetica-Oblique", 10)
            p.drawString(1 * inch, current_y, f"This is a computer-generated receipt by {settings.company_name} and does not require a physical signature.")
            
            p.showPage()
            p.save()
            return response
            
        except OwnerListingPass.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
