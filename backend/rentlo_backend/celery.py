import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rentlo_backend.settings')

app = Celery('rentlo_backend')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

app.conf.beat_schedule = {
    # ─── Listing Expiry (9:10 AM IST = 3:40 UTC) ──────────────────────────────
    # Runs AFTER morning notifications so owners get warning before listing drops
    'expire-old-properties-daily': {
        'task': 'properties.tasks.expire_old_properties',
        'schedule': crontab(hour=3, minute=40),  # 9:10 AM IST
    },
    # ─── Property-level expiry warnings ───────────────────────────────────────
    'notify-expiring-properties-daily': {
        'task': 'properties.tasks.notify_expiring_properties',
        'schedule': crontab(hour=3, minute=30),  # 9:00 AM IST
    },
    # ─── Owner Pass Expiry Countdown Push Notifications (9:00 AM IST daily) ───
    # Sends: "3 days left", "2 days left", "1 day left", "Expires TODAY"
    'notify-pass-expiry-countdown-daily': {
        'task': 'unlocks.tasks.notify_pass_expiry_countdown',
        'schedule': crontab(hour=3, minute=30),  # 9:00 AM IST (UTC = IST - 5:30)
    },
    # ─── Auto-expire depleted/old passes ─────────────────────────────────────
    'expire-passes-daily': {
        'task': 'unlocks.tasks.expire_passes',
        'schedule': crontab(hour=1, minute=0),  # 6:30 AM IST
    },
    # ─── Agent payouts (weekly Monday 7:30 AM IST) ───────────────────────────
    'generate-weekly-agent-payouts': {
        'task': 'earnings.tasks.generate_weekly_payouts',
        'schedule': crontab(hour=2, minute=0, day_of_week=1),
    },
}
