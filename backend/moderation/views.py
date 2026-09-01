from rest_framework import views, status, generics
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from properties.models import Property
from accounts.models import User
from .models import ModerationLog
from accounts.permissions import IsAdminOrModerator, IsAdmin
from accounts.serializers import UserSerializer
import logging

audit_logger = logging.getLogger('audit')

class ModeratePropertyView(views.APIView):
    permission_classes = [IsAdminOrModerator]

    def post(self, request, property_id):
        try:
            prop = Property.objects.get(id=property_id)
        except Property.DoesNotExist:
            return Response({'detail': 'Property not found'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        notes = request.data.get('notes', '')

        if action not in ['approve', 'reject', 'flag_fraud']:
            return Response({'detail': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

        if action == 'reject' and not notes:
            return Response({'detail': 'Reason is required for rejection'}, status=status.HTTP_400_BAD_REQUEST)

        if action == 'approve':
            with transaction.atomic():
                prop = Property.objects.select_for_update().get(id=property_id)
                # Ensure it hasn't been approved by another thread already
                if prop.status == 'live':
                    return Response({'detail': 'Property already approved'}, status=status.HTTP_400_BAD_REQUEST)

                old_status = prop.status
                prop.status = 'live'
                from properties.models import PlatformSettings
                ps = PlatformSettings.load()
                if prop.property_category == 'pg' or prop.property_type in ['pg', 'pg_hostel', 'pg_single', 'pg_double', 'pg_triple', 'hostel']:
                    val_days = ps.validity_apt_pg_1pack_days if (ps.validity_apt_pg_1pack_days is not None) else (ps.validity_apt_pg_days or 60)
                elif prop.property_category == 'commercial' or prop.property_type in ['shop', 'office', 'warehouse', 'showroom', 'industrial', 'commercial_building']:
                    val_days = ps.validity_commercial_1pack_days if (ps.validity_commercial_1pack_days is not None) else (ps.validity_commercial_days or 0)
                else:
                    val_days = ps.validity_residential_1pack_days if (ps.validity_residential_1pack_days is not None) else (ps.validity_residential_days or 0)

                if val_days and int(val_days) > 0:
                    prop.expires_at = timezone.now() + timedelta(days=int(val_days))
                else:
                    prop.expires_at = None  # Active until rented!
                prop.rejection_reason = None
                prop.reviewed_at = timezone.now()
                prop.save()
                ModerationLog.objects.create(property=prop, moderator=request.user, action='approved', notes=notes)
                
                from properties.models import PropertyAuditLog
                ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
                if ip and ',' in ip: ip = ip.split(',')[0].strip()
                ua = request.META.get('HTTP_USER_AGENT', '')[:300]

                PropertyAuditLog.objects.create(
                    property=prop,
                    changed_by=request.user,
                    field_name='status',
                    old_value=str(old_status),
                    new_value='live',
                    event_category='moderation',
                    reason=notes or "Listing approved and published by moderator",
                    ip_address=ip,
                    user_agent=ua,
                    metadata={'action': 'approved', 'notes': notes}
                )
                
                audit_logger.info(f"Property {prop.id} approved by moderator {request.user.username}")

                # Auto-create earnings
                if prop.agent and prop.locality and prop.locality.city:
                    from earnings.models import CommissionRule, EarningEntry
                    from django.db.models import Q
                    
                    # Check for agent-specific rule, else city default
                    rule = CommissionRule.objects.filter(agent=prop.agent, city=prop.locality.city, rule_type='flat_per_listing', is_active=True).first()
                    if not rule:
                        rule = CommissionRule.objects.filter(agent__isnull=True, city=prop.locality.city, rule_type='flat_per_listing', is_active=True).first()
                    
                    if rule:
                        EarningEntry.objects.create(
                            agent=prop.agent,
                            property=prop,
                            source_type='listing_approved',
                            amount=rule.amount_or_percent,
                            status='pending'
                        )
                
                # Notify buyers with matching saved searches
                try:
                    from properties.tasks import notify_saved_searches
                    notify_saved_searches.delay(prop.id)
                except Exception as e:
                    audit_logger.warning(f"Could not dispatch saved search notification: {str(e)}")

            return Response({'detail': 'Property approved successfully'})

        elif action == 'reject':
            old_status = prop.status
            prop.status = 'rejected'
            prop.rejection_reason = notes
            prop.reviewed_at = timezone.now()
            prop.save()
            ModerationLog.objects.create(property=prop, moderator=request.user, action='rejected', notes=notes)
            
            from properties.models import PropertyAuditLog
            ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
            if ip and ',' in ip: ip = ip.split(',')[0].strip()
            ua = request.META.get('HTTP_USER_AGENT', '')[:300]

            PropertyAuditLog.objects.create(
                property=prop,
                changed_by=request.user,
                field_name='status',
                old_value=str(old_status),
                new_value='rejected',
                event_category='moderation',
                reason=notes or "Listing rejected by moderator",
                ip_address=ip,
                user_agent=ua,
                metadata={'action': 'rejected', 'rejection_reason': notes}
            )
            
            audit_logger.info(f"Property {prop.id} rejected by moderator {request.user.username}. Reason: {notes}")
            return Response({'detail': 'Property rejected successfully'})

        elif action == 'flag_fraud':
            target_user = prop.agent or prop.owner
            target_username = "Unknown"
            if target_user:
                target_user.fraud_flag_count += 1
                target_user.save()
                target_username = target_user.username

            # Also reject the property if it's fraudulent
            old_status = prop.status
            prop.status = 'rejected'
            prop.rejection_reason = f"Flagged for fraud: {notes}"
            prop.reviewed_at = timezone.now()
            prop.save()
            ModerationLog.objects.create(property=prop, moderator=request.user, action='rejected', notes=f"FRAUD FLAG: {notes}")
            
            from properties.models import PropertyAuditLog
            ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
            if ip and ',' in ip: ip = ip.split(',')[0].strip()
            ua = request.META.get('HTTP_USER_AGENT', '')[:300]

            PropertyAuditLog.objects.create(
                property=prop,
                changed_by=request.user,
                field_name='is_fraud_flagged',
                old_value='False',
                new_value='True',
                event_category='security',
                reason=f"Flagged for fraud: {notes}",
                ip_address=ip,
                user_agent=ua,
                metadata={'action': 'fraud_flag', 'flagged_user': target_username, 'notes': notes}
            )
            
            audit_logger.info(f"FRAUD FLAG: Property {prop.id} and User {target_username} flagged by {request.user.username}")
            return Response({'detail': 'Listing flagged for fraud and property rejected.'})

class AgentFraudListView(generics.ListAPIView):
    permission_classes = [IsAdminOrModerator]
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.filter(fraud_flag_count__gt=0).order_by('-fraud_flag_count')
