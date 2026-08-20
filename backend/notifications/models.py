from django.db import models
from accounts.models import User
from properties.models import Property
from django.db.models.signals import post_save
from django.dispatch import receiver
from pywebpush import webpush, WebPushException
import json
import logging
import threading

logger = logging.getLogger(__name__)

class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    property = models.ForeignKey(Property, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"To {self.recipient.username}: {self.message[:20]}"


def _send_single_web_push(sub_id, payload_str, private_key, admin_email):
    from accounts.models import PushSubscription
    try:
        sub = PushSubscription.objects.get(id=sub_id)
    except PushSubscription.DoesNotExist:
        return

    try:
        webpush(
            subscription_info={
                'endpoint': sub.endpoint,
                'keys': {
                    'p256dh': sub.p256dh,
                    'auth': sub.auth
                }
            },
            data=payload_str,
            vapid_private_key=private_key,
            vapid_claims={
                'sub': admin_email
            }
        )
    except WebPushException as ex:
        if ex.response is not None and ex.response.status_code in [404, 410]:
            sub.delete()
        else:
            logger.error("WebPush send failed: %s", ex)
    except Exception as ex:
        logger.error("WebPush send error: %s", ex)


@receiver(post_save, sender=Notification)
def send_web_push_notification(sender, instance, created, **kwargs):
    if not created:
        return

    from django.conf import settings
    vapid_pub = getattr(settings, 'VAPID_PUBLIC_KEY', None)
    vapid_priv = getattr(settings, 'VAPID_PRIVATE_KEY', None)
    vapid_email = getattr(settings, 'VAPID_ADMIN_EMAIL', None)

    if not vapid_pub or not vapid_priv or not vapid_email:
        return

    from accounts.models import PushSubscription
    subs = PushSubscription.objects.filter(user=instance.recipient)
    if not subs.exists():
        return

    url = "/"
    if instance.property:
        if instance.message.startswith("💬") or "message" in instance.message.lower() or "chat" in instance.message.lower():
            url = f"/chat/{instance.property.id}"
        else:
            url = f"/property/{instance.property.id}"

    payload = {
        'title': 'Rentlo Alert 🔔',
        'body': instance.message,
        'url': url
    }
    payload_str = json.dumps(payload)

    for sub in subs:
        t = threading.Thread(
            target=_send_single_web_push,
            args=(sub.id, payload_str, vapid_priv, vapid_email)
        )
        t.daemon = True
        t.start()
