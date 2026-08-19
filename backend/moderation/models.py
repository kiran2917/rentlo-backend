from django.db import models
from properties.models import Property
from accounts.models import User

class ModerationLog(models.Model):
    ACTION_CHOICES = [
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='moderation_logs')
    moderator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='moderations')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    notes = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.property.id} - {self.action} by {self.moderator.username if self.moderator else 'Unknown'}"
