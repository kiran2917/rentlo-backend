from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import BuyerSubscription
import logging

logger = logging.getLogger('django')

@shared_task
def expire_passes():
    """
    Periodic background task to mark buyer subscriptions as 'expired'
    once their expires_at date has passed.
    """
    now = timezone.now()
    expired_count = BuyerSubscription.objects.filter(
        status='active',
        expires_at__isnull=False,
        expires_at__lt=now
    ).update(status='expired')

    if expired_count > 0:
        logger.info(f"Celery Task: Expired {expired_count} stale buyer subscription passes.")

    return expired_count


@shared_task
def notify_listing_expiry_countdown():
    """
    Runs daily at 9:00 AM IST via Celery Beat.

    Sends a web push notification to the PROPERTY OWNER when their
    PG listing is about to expire in:
      - 3 days  → "⏳ Your PG listing expires in 3 days"
      - 2 days  → "⏳ Your PG listing expires in 2 days"
      - 1 day   → "🚨 Your PG listing expires TOMORROW"
      - 0 days  → "🔴 Your PG listing expires TODAY"

    After expiry: the property goes 'expired', buyer sees it offline.
    Owner taps "Renew & Go Live" → consumes 1 new credit from their remaining
    pass balance → property gets a fresh validity period and goes live again.

    NOTE: This is per-PROPERTY, not per-PASS.
    Example: Owner buys 3-credit 30-day pass → lists 1 PG → 1 credit gone,
    2 remaining. That PG listing lives for 30 days. After 30 days it expires.
    Owner clicks Renew → 1 more credit consumed, listing lives another 30 days.
    """
    from properties.models import Property
    from notifications.models import Notification

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    notified = 0

    # Day-specific messages
    COUNTDOWN = {
        3: ("⏳ PG Listing Expires in 3 Days",
            "Your PG listing will go offline in 3 days. Renew from your dashboard using 1 credit to keep it live."),
        2: ("⏳ PG Listing Expires in 2 Days",
            "2 days left! Your PG listing is expiring soon. Tap to renew with 1 credit and stay visible to tenants."),
        1: ("🚨 PG Listing Expires Tomorrow!",
            "Your PG listing expires TOMORROW morning. Renew now using 1 credit to avoid going offline."),
        0: ("🔴 PG Listing Expires TODAY",
            "Your PG listing expires TODAY. Renew immediately from your Owner Dashboard to keep your listing live."),
    }

    for days_left, (title, body_template) in COUNTDOWN.items():
        # Find all live PG listings whose expires_at falls within this specific day
        target_start = today_start + timedelta(days=days_left)
        target_end   = target_start + timedelta(days=1)

        expiring_listings = Property.objects.filter(
            status='live',
            expires_at__gte=target_start,
            expires_at__lt=target_end,
        ).select_related('owner', 'locality')

        for prop in expiring_listings:
            # Properties must have an owner to notify
            recipient = prop.owner
            if not recipient:
                recipient = prop.agent  # fallback to agent if no owner set
            if not recipient:
                continue

            locality_name = prop.locality.name if prop.locality else "your area"
            prop_label = prop.property_type.replace('_', ' ').title()

            # Deduplicate: don't send same day's notification twice in one day
            already_sent = Notification.objects.filter(
                recipient=recipient,
                property=prop,
                message__startswith=title,
                created_at__gte=today_start,
            ).exists()

            if already_sent:
                continue

            full_message = (
                f"{title}: {body_template} "
                f"(Listing #{prop.id} · {prop_label} in {locality_name})"
            )

            # Creating a Notification auto-fires web push via post_save signal
            Notification.objects.create(
                recipient=recipient,
                property=prop,
                message=full_message,
            )
            notified += 1
            logger.info(
                f"ListingExpiry: Sent '{title}' to {recipient.username} "
                f"for Property #{prop.id} ({prop_label} in {locality_name}), "
                f"{days_left} day(s) left, expires {prop.expires_at.date()}"
            )

    return f"Sent {notified} listing expiry countdown notification(s)."
