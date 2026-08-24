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
def notify_pass_expiry_countdown():
    """
    Runs daily at 9:00 AM IST via Celery Beat.
    Sends a web push notification to owners whose listing pass expires in:
      - 3 days  → "Your PG listing pass expires in 3 days"
      - 2 days  → "Your PG listing pass expires in 2 days"
      - 1 day   → "Your PG listing pass expires TOMORROW"
      - 0 days  → "Your PG listing pass expires TODAY"

    The Notification model's post_save signal auto-dispatches web push
    to the owner's browser/phone via pywebpush + VAPID keys.
    """
    from .models import OwnerListingPass
    from notifications.models import Notification

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    notified = 0

    MESSAGES = {
        3: ("⏳ Listing Pass Expiring Soon",    "Your PG/Hostel listing pass expires in 3 days. Renew your credits to keep your listing live."),
        2: ("⏳ Listing Pass Expiring in 2 Days", "Your PG/Hostel listing pass expires in 2 days. Don't lose your active leads — renew now!"),
        1: ("🚨 Pass Expires Tomorrow!",         "Your PG/Hostel listing pass expires TOMORROW morning. Renew credits today to avoid your listing going offline."),
        0: ("🔴 Pass Expires TODAY",             "Your PG/Hostel listing pass expires TODAY. Renew immediately from your Owner Dashboard to keep your listing live."),
    }

    for days_left, (title, body) in MESSAGES.items():
        # Target window: passes whose expires_at falls within exactly this day
        target_start = today_start + timedelta(days=days_left)
        target_end   = target_start + timedelta(days=1)

        expiring_passes = OwnerListingPass.objects.filter(
            status='active',
            credits_remaining__gt=0,
            expires_at__gte=target_start,
            expires_at__lt=target_end,
        ).select_related('owner')

        for pass_obj in expiring_passes:
            owner = pass_obj.owner

            # Deduplicate: don't send the same countdown day twice in one day
            already_sent = Notification.objects.filter(
                recipient=owner,
                message__startswith=title,
                created_at__gte=today_start,
            ).exists()

            if already_sent:
                continue

            cat_label = (pass_obj.category or 'listing').replace('_', ' ').title()
            full_message = (
                f"{title}: {body} "
                f"({cat_label} Pass · {pass_obj.credits_remaining} credit(s) remaining)"
            )

            # Creating the Notification auto-triggers web push via post_save signal
            Notification.objects.create(
                recipient=owner,
                property=None,
                message=full_message,
            )
            notified += 1
            logger.info(
                f"PassExpiry: Sent '{title}' to {owner.username} "
                f"(pass #{pass_obj.id}, expires {pass_obj.expires_at.date()}, {days_left}d left)"
            )

    return f"Sent {notified} pass expiry countdown notification(s)."
