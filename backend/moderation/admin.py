from django.contrib import admin
from .models import ModerationLog

@admin.register(ModerationLog)
class ModerationLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'property', 'moderator', 'action', 'timestamp')
    list_filter = ('action', 'timestamp')
