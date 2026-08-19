from django.contrib import admin
from .models import PropertyMedia

@admin.register(PropertyMedia)
class PropertyMediaAdmin(admin.ModelAdmin):
    list_display = ('id', 'property', 'display_order', 'image_url')
    list_filter = ('property',)
