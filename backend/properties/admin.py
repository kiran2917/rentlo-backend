from django.contrib import admin
from .models import Property

@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ('id', 'property_type', 'status', 'registration_fee_paid', 'registration_payment_method', 'registration_utr', 'price', 'created_at')
    list_filter = ('status', 'registration_fee_paid', 'registration_payment_method', 'property_type', 'created_at')
    search_fields = ('owner_name', 'registration_utr', 'description')

from .models import PlatformSettingsAuditLog

@admin.register(PlatformSettingsAuditLog)
class PlatformSettingsAuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'changed_by', 'field_name', 'old_value', 'new_value', 'ip_address', 'changed_at')
    list_filter = ('field_name', 'changed_at')
    search_fields = ('changed_by__username', 'field_name', 'ip_address')
    readonly_fields = ('changed_by', 'field_name', 'old_value', 'new_value', 'ip_address', 'changed_at')
