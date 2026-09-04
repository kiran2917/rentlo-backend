from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from properties.models import Property, SavedSearch, OTPVerification, PlatformSettings
from notifications.models import Notification
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Executes automated background lifecycle tasks: auto-expires stale listings, matches saved searches, triggers owner reconfirmation, and cleans expired OTPs."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE(f"[{timezone.now()}] Starting Rentlo Background Tasks..."))
        
        expired_count = self.expire_stale_properties()
        reconfirm_count = self.trigger_reconfirmation_reminders()
        matched_searches = self.match_saved_searches()
        cleaned_otps = self.cleanup_expired_otps()

        self.stdout.write(self.style.SUCCESS(
            f"Successfully executed background tasks:\n"
            f" - Expired listings archived: {expired_count}\n"
            f" - Reconfirmation reminders queued: {reconfirm_count}\n"
            f" - Saved search alerts generated: {matched_searches}\n"
            f" - Expired OTPs cleaned: {cleaned_otps}"
        ))

    def expire_stale_properties(self):
        """Finds live properties past their expires_at date and marks them expired."""
        now = timezone.now()
        expired_qs = Property.objects.filter(
            status__in=['live', 'under_negotiation'],
            expires_at__lt=now
        )
        count = expired_qs.count()
        if count > 0:
            for prop in expired_qs:
                prop.status = 'expired'
                prop.save(update_fields=['status'])
                # Notify owner
                if prop.owner:
                    Notification.objects.create(
                        recipient=prop.owner,
                        property=prop,
                        message=f"Your listing for '{prop.get_property_type_display()}' has expired. Please reconfirm or renew it in your Owner Dashboard."
                    )
            logger.info(f"Auto-expired {count} stale properties.")
        return count

    def trigger_reconfirmation_reminders(self):
        """Notifies owners of properties that haven't been updated/reconfirmed in 14 days."""
        cutoff = timezone.now() - timedelta(days=14)
        stale_props = Property.objects.filter(
            status='live',
            updated_at__lt=cutoff
        )
        count = 0
        for prop in stale_props:
            if prop.owner:
                # Check if recent notification already sent in the last 3 days
                already_notified = Notification.objects.filter(
                    recipient=prop.owner,
                    property=prop,
                    message__icontains="reconfirm availability",
                    created_at__gte=timezone.now() - timedelta(days=3)
                ).exists()
                
                if not already_notified:
                    Notification.objects.create(
                        recipient=prop.owner,
                        property=prop,
                        message=f"Is your property in {prop.locality.name if prop.locality else 'your area'} still available? Please click to reconfirm availability."
                    )
                    count += 1
        return count

    def match_saved_searches(self):
        """Matches live properties created in the last 24h against buyer saved searches."""
        recent_cutoff = timezone.now() - timedelta(days=1)
        recent_props = Property.objects.filter(status='live', created_at__gte=recent_cutoff)
        saved_searches = SavedSearch.objects.select_related('buyer', 'city')
        
        matches_generated = 0
        for search in saved_searches:
            for prop in recent_props:
                # Check city
                if search.city and prop.locality and prop.locality.city_id != search.city.id:
                    continue
                # Check locality
                if search.locality and prop.locality and prop.locality.name.lower() != search.locality.lower():
                    continue
                # Check property type
                if search.property_type and prop.property_type != search.property_type:
                    continue
                # Check price range
                if search.min_price and prop.price < search.min_price:
                    continue
                if search.max_price and prop.price > search.max_price:
                    continue
                
                # Check if notification already delivered for this property to this buyer
                already_sent = Notification.objects.filter(
                    recipient=search.buyer,
                    property=prop
                ).exists()
                
                if not already_sent:
                    Notification.objects.create(
                        recipient=search.buyer,
                        property=prop,
                        message=f"New property match: {prop.get_property_type_display()} in {prop.locality.name if prop.locality else 'your preferred city'} matching your saved search preferences."
                    )
                    matches_generated += 1

        return matches_generated

    def cleanup_expired_otps(self):
        """Deletes OTP records older than 24 hours."""
        old_cutoff = timezone.now() - timedelta(hours=24)
        deleted, _ = OTPVerification.objects.filter(expires_at__lt=old_cutoff).delete()
        return deleted
