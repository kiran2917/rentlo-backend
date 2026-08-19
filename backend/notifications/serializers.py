from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'message', 'is_read', 'property', 'created_at']
        read_only_fields = ['id', 'message', 'property', 'created_at']
