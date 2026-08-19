from django.db import models
from properties.models import Property

class PropertyMedia(models.Model):
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='media')
    image_url = models.URLField(max_length=500)
    medium_url = models.URLField(max_length=500, blank=True, null=True)
    thumbnail_url = models.URLField(max_length=500, blank=True, null=True)
    image_hash = models.CharField(max_length=64, null=True, blank=True)
    display_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['display_order']

    def __str__(self):
        return f"Media for {self.property.id} (Order: {self.display_order})"
