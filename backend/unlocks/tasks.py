from celery import shared_task
from django.utils import timezone
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
