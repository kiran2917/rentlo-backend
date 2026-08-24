import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rentlo_backend.settings')

app = Celery('rentlo_backend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    # ─── Step 1: Send 3/2/1/0-day countdown push notifications at 9:00 AM IST ─
    # Fires BEFORE the listing is actually expired, so owner gets warning first
    'notify-listing-expiry-countdown-daily': {
        'task': 'unlocks.tasks.notify_listing_expiry_countdown',
        'schedule': crontab(hour=3, minute=30),  # 9:00 AM IST (UTC = IST - 5:30)
    },

    # ─── Step 2: Auto-expire live PG listings at 9:15 AM IST ──────────────────
    # Runs 15 minutes AFTER notifications so owner gets the alert before expiry
    'expire-old-properties-daily': {
        'task': 'properties.tasks.expire_old_properties',
        'schedule': crontab(hour=3, minute=45),  # 9:15 AM IST
    },

    # ─── Step 3: Auto-expire old buyer passes at 6:30 AM IST ─────────────────
    'expire-passes-daily': {
        'task': 'unlocks.tasks.expire_passes',
        'schedule': crontab(hour=1, minute=0),  # 6:30 AM IST
    },

    # ─── Agent payouts (every Monday 7:30 AM IST) ────────────────────────────
    'generate-weekly-agent-payouts': {
        'task': 'earnings.tasks.generate_weekly_payouts',
        'schedule': crontab(hour=2, minute=0, day_of_week=1),
    },
}
