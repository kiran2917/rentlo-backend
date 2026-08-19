from django.contrib import admin
from .models import Unlock

@admin.register(Unlock)
class UnlockAdmin(admin.ModelAdmin):
    list_display = ('id', 'buyer', 'property', 'amount', 'status', 'unlocked_at')
    list_filter = ('status', 'unlocked_at')
