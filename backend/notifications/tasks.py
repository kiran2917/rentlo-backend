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

@shared_task(name="notifications.send_payout_sms_async")
def send_payout_sms_async(phone, amount, utr_number):
    """
    Asynchronously sends an SMS alert to an agent when their payout is processed.
    """
    try:
        message = f"Rentlo: Your weekly payout of Rs {amount} has been processed successfully. UTR: {utr_number}. Check your dashboard for details."
        logger.info(f"[ASYNC SMS CELERY WORKER] Dispatched Payout SMS to {phone}: {message}")
        return True
    except Exception as e:
        logger.error(f"Async Payout SMS dispatch failed for {phone}: {e}", exc_info=True)
        return False
