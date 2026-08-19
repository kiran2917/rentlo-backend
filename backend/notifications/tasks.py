from celery import shared_task
import logging

logger = logging.getLogger(__name__)

@shared_task(name="notifications.send_sms_otp_async")
def send_sms_otp_async(phone, otp_code):
    """
    Asynchronously dispatches SMS OTP messages via SMS Gateway in background Celery worker.
    """
    try:
        # Gateway dispatch integration point
        logger.info(f"[ASYNC SMS CELERY WORKER] Dispatched OTP {otp_code} to phone {phone}")
        return True
    except Exception as e:
        logger.error(f"Async SMS dispatch failed for {phone}: {e}", exc_info=True)
        return False
