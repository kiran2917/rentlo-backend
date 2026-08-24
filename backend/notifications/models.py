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
        from py_vapid import Vapid
        vapid_key = Vapid.from_pem(private_key.encode())
    except Exception as ex:
        logger.error("WebPush failed to load PEM private key: %s", ex)
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
            vapid_private_key=vapid_key,
            vapid_claims={
                'sub': admin_email
            }
        )
        logger.info(f"Web Push: Successfully sent push notification to {sub.user.username}'s endpoint {sub.endpoint[:40]}")
    except WebPushException as ex:
        if ex.response is not None and ex.response.status_code in [404, 410]:
            logger.warning(f"Web Push: Subscription expired (status {ex.response.status_code}), removing from DB: {sub.endpoint[:40]}")
            sub.delete()
        else:
            logger.error("WebPush send failed: %s", ex)
    except Exception as ex:
        logger.error("WebPush send error: %s", ex)


@receiver(post_save, sender=Notification)
def send_web_push_notification(sender, instance, created, **kwargs):
    if not created:
        return

    logger.info(f"Web Push: Notification created for user {instance.recipient.username} (ID: {instance.recipient.id}, Message: {instance.message[:40]})")

    from django.conf import settings
    vapid_pub = getattr(settings, 'VAPID_PUBLIC_KEY', None)
    vapid_priv = getattr(settings, 'VAPID_PRIVATE_KEY', None)
    vapid_email = getattr(settings, 'VAPID_ADMIN_EMAIL', None)

    if not vapid_pub or not vapid_priv or not vapid_email:
        logger.warning(f"Web Push: VAPID keys missing. pub: {bool(vapid_pub)}, priv: {bool(vapid_priv)}, email: {bool(vapid_email)}")
        return

    from accounts.models import PushSubscription
    subs = PushSubscription.objects.filter(user=instance.recipient)
    logger.info(f"Web Push: Found {subs.count()} active subscriptions for user {instance.recipient.username}")
    if not subs.exists():
        return

    url = "/"
    msg = instance.message.strip()
    title = "Rentlo Alert 🔔"
    body = msg

    if instance.property:
        prop = instance.property
        prop_label = prop.property_type.replace('_', ' ').title() if prop.property_type else 'Property'
        loc_name = prop.locality.name if prop.locality else ''

        if "💬" in msg or "message" in msg.lower() or "chat" in msg.lower():
            url = f"/chat/{prop.id}"
            if "from " in msg and " regarding " in msg:
                try:
                    sender_part = msg.split("from ")[1].split(" regarding ")[0]
                    content_part = msg.split("regarding ")[1]
                    title = f"💬 Message from {sender_part}"
                    body = f"Regarding {content_part}"
                except Exception:
                    title = "💬 New Message"
                    body = msg
            else:
                title = "💬 New Chat Message"
        elif "🗓️" in msg or "visit booking" in msg.lower() or "viewing" in msg.lower():
            url = f"/owner/visits" if getattr(instance.recipient, 'is_owner', False) else f"/property/{prop.id}"
            if "requested a viewing" in msg:
                title = "🗓️ New Visit Request"
                body = msg.replace("🗓️ New Visit Booking: ", "").replace("🗓️ ", "")
            elif "approved" in msg.lower():
                title = "🎉 Visit Confirmed!"
                body = msg.replace("🎉 Visit Approved! ", "").replace("🎉 ", "")
            elif "declined" in msg.lower() or "rejected" in msg.lower():
                title = "📅 Visit Update"
                body = msg.replace("❌ Visit Update: ", "").replace("❌ ", "")
            else:
                title = "📅 Visit Schedule Update"
        elif "🔥" in msg or "new lead" in msg.lower():
            url = f"/owner/leads" if getattr(instance.recipient, 'is_owner', False) else f"/property/{prop.id}"
            title = "🔥 New Verified Lead!"
            body = f"A buyer unlocked contact details for your {prop_label} in {loc_name}. Tap to connect."
        elif "unlocked" in msg.lower():
            url = f"/my-unlocks"
            title = "🔑 Contact Unlocked!"
            body = f"Owner contact details for {prop_label} #{prop.id} in {loc_name} are now visible."

        # ── No property attached — check message type ──────────────────────
        if "credit pass" in msg.lower() or "buyer credit" in msg.lower():
            url = "/my-unlocks"
            title = "⭐ Pass Activated!"
            body = msg.replace("Payment verified! ", "")
        elif "listing credits" in msg.lower():
            url = "/owner/dashboard"
            title = "💎 Listing Credits Added!"
            body = msg.replace("Payment verified! ", "")
        elif "payment" in msg.lower():
            title = "💳 Payment Confirmed"
            body = msg


    payload = {
        'title': title,
        'body': body,
        'url': url,
        'tag': f"rentlo-{instance.id}-{int(instance.created_at.timestamp())}"
    }
    payload_str = json.dumps(payload)

    for sub in subs:
        logger.info(f"Web Push: Spawning background thread to send push ({title}) to endpoint: {sub.endpoint[:60]}...")
        t = threading.Thread(
            target=_send_single_web_push,
            args=(sub.id, payload_str, vapid_priv, vapid_email)
        )
        t.daemon = True
        t.start()
