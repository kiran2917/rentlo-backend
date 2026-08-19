from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (None, {'fields': ('roles', 'phone')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {'fields': ('roles', 'phone')}),
    )
    list_display = ('username', 'email', 'get_roles', 'phone', 'is_staff')
    list_filter = ('is_staff', 'is_superuser', 'is_active')

    def get_roles(self, obj):
        return ", ".join(obj.roles) if obj.roles else "None"
    get_roles.short_description = 'Roles'

admin.site.register(User, CustomUserAdmin)
