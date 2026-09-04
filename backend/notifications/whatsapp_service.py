import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

def send_whatsapp_lead_alert(recipient_phone: str, property_obj, buyer_name: str = "Prospective Tenant", buyer_phone: str = "") -> bool:
    """
    Sends an automated WhatsApp alert to the property owner/agent using Meta WhatsApp Cloud API.
    Uses Meta's official Graph API endpoint with 1,000 FREE service/utility messages/month.
    
    Args:
        recipient_phone: 10-digit Indian phone number of the property owner/agent
        property_obj: Property instance
        buyer_name: Name of the buyer who unlocked the property
        buyer_phone: Phone number of the buyer who unlocked the property
    """
    if not recipient_phone:
        return False

    # Clean recipient phone number (format with 91 prefix)
    clean_phone = recipient_phone.replace("+", "").replace("-", "").replace(" ", "")
    if len(clean_phone) == 10:
        clean_phone = f"91{clean_phone}"
    elif len(clean_phone) == 12 and clean_phone.startswith("91"):
        pass
    else:
        logger.warning(f"Invalid phone number format for WhatsApp alert: {recipient_phone}")
        return False

    # ── 1. Check for 100% Free Unlimited Self-Hosted VPS WhatsApp Gateway ──
    vps_gateway_url = getattr(settings, 'VPS_WHATSAPP_GATEWAY_URL', 'http://127.0.0.1:3000/send-message')
    prop_title = getattr(property_obj, 'display_title', '') or getattr(property_obj, 'title', '') or property_obj.property_type
    locality_name = property_obj.locality.name if property_obj.locality else "your area"
    lead_contact = f"{buyer_name} ({buyer_phone})" if buyer_phone else buyer_name
    msg_text = f"🎉 *Rentlo New Lead Alert!*\nA tenant just unlocked your listing: *{prop_title}* in *{locality_name}*.\n\n👤 *Tenant Contact:* {lead_contact}\n👉 Log in to your Owner Dashboard on Rentlo to manage visits."

    try:
        vps_res = requests.post(
            vps_gateway_url,
            json={"phone": clean_phone, "message": msg_text},
            timeout=3
        )
        if vps_res.status_code in [200, 201]:
            logger.info(f"Self-Hosted VPS WhatsApp: Delivered alert to {clean_phone}")
            return True
    except Exception:
        # If local VPS microservice is not active, fallback to Meta Cloud API or log
        pass

    # ── 2. Fallback to Meta Cloud API (1,000 Free msgs/month) ──
    phone_number_id = ""
    access_token = ""
    template_name = "rentlo_lead_alert"

    try:
        from properties.models import PlatformSettings
        ps = PlatformSettings.load()
        phone_number_id = getattr(ps, 'whatsapp_phone_number_id', '') or getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')
        access_token = getattr(ps, 'whatsapp_access_token', '') or getattr(settings, 'WHATSAPP_ACCESS_TOKEN', '')
    except Exception:
        phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')
        access_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', '')

    if not phone_number_id or not access_token:
        return False

    url = f"https://graph.facebook.com/v20.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Payload matching Meta's template message format
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": { "code": "en" },
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        { "type": "text", "text": str(prop_title) },
                        { "type": "text", "text": str(locality_name) },
                        { "type": "text", "text": str(lead_contact) }
                    ]
                }
            ]
        }
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=8)
        if response.status_code in [200, 201]:
            logger.info(f"WhatsApp alert successfully delivered to {clean_phone} for Property #{property_obj.id}")
            return True
        else:
            # If template fails (e.g. template not yet approved in Meta portal), try fallback text message
            logger.warning(f"WhatsApp template dispatch failed (status {response.status_code}): {response.text}")
            
            # Fallback direct text message (works within 24h conversation window)
            text_payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_phone,
                "type": "text",
                "text": {
                    "body": f"🎉 *Rentlo New Lead Alert!*\nA tenant just unlocked your listing: *{prop_title}* in *{locality_name}*.\n\n👤 *Tenant Contact:* {lead_contact}\n👉 Log in to your Owner Dashboard on Rentlo to manage visits."
                }
            }
            fb_resp = requests.post(url, json=text_payload, headers=headers, timeout=8)
            return fb_resp.status_code in [200, 201]

    except Exception as e:
        logger.error(f"Error sending WhatsApp message to {clean_phone}: {e}")
        return False
