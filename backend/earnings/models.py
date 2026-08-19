from django.db import models
from django.conf import settings
from properties.models import City, Property

class CommissionRule(models.Model):
    RULE_TYPE_CHOICES = (
        ('flat_per_listing', 'Flat per Listing'),
        ('percent_per_unlock', 'Percent per Unlock'),
        ('flat_per_unlock', 'Flat per Unlock'),
    )
    
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='commission_rules')
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='commission_rules')
    rule_type = models.CharField(max_length=50, choices=RULE_TYPE_CHOICES)
    amount_or_percent = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        agent_str = self.agent.username if self.agent else "Default"
        return f"{agent_str} - {self.city.name} - {self.get_rule_type_display()}"


class EarningEntry(models.Model):
    SOURCE_TYPE_CHOICES = (
        ('listing_approved', 'Listing Approved'),
        ('unlock_generated', 'Unlock Generated'),
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('paid', 'Paid'),
    )

    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='earnings')
    property = models.ForeignKey(Property, on_delete=models.SET_NULL, null=True, blank=True, related_name='earnings')
    source_type = models.CharField(max_length=50, choices=SOURCE_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments_made')
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.agent.username} - {self.amount} - {self.status}"
