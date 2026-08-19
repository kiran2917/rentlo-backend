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
    'expire-old-properties-daily': {
        'task': 'properties.tasks.expire_old_properties',
        'schedule': crontab(hour=0, minute=0), # Run daily at midnight
    },
    'notify-expiring-properties-daily': {
        'task': 'properties.tasks.notify_expiring_properties',
        'schedule': crontab(hour=0, minute=15), # Run daily at 12:15 AM
    },
    'expire-passes-daily': {
        'task': 'unlocks.tasks.expire_passes',
        'schedule': crontab(hour=1, minute=0), # Run daily at 1:00 AM
    },
}
