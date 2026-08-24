from django.db import models
from django.utils import timezone
from accounts.models import User
from properties.models import Property

class Unlock(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]

    LEAD_STATUS_CHOICES = [
        ('new', 'New'),
        ('contacted', 'Contacted'),
        ('rented', 'Deal Closed / Rented'),
        ('rejected', 'Rejected'),
    ]

    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='unlocks')
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='unlocks')
    buyer_subscription = models.ForeignKey('BuyerSubscription', on_delete=models.SET_NULL, null=True, blank=True, related_name='unlocked_items')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    PAYMENT_CHOICES = [
        ('razorpay', 'Razorpay'),
        ('upi', 'Direct UPI')
    ]
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default='razorpay')
    utr = models.CharField(max_length=50, blank=True, null=True)
    
    gateway_txn_id = models.CharField(max_length=100, blank=True, null=True)
    order_id = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    lead_status = models.CharField(max_length=20, choices=LEAD_STATUS_CHOICES, default='new')
    created_at = models.DateTimeField(default=timezone.now)
    unlocked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.buyer.username} unlocked {self.property.id} ({self.status})"

class Feedback(models.Model):
    unlock = models.ForeignKey(Unlock, on_delete=models.CASCADE, related_name='feedbacks')
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='given_feedbacks')
    is_accurate = models.BooleanField()
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('unlock',)

    def __str__(self):
        return f"Feedback for unlock {self.unlock.id} by {self.buyer.username} - Accurate: {self.is_accurate}"

class BuyerSubscription(models.Model):
    PASS_TYPES = [
        ('single_14', 'Single Unlock (₹14)'),
        ('starter_39', 'Starter Pass (₹39)'),
        ('smart_79', 'Smart Pass (₹79)'),
        ('pro_129', 'Pro Hunter Pass (₹129)'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('depleted', 'Depleted'),
        ('failed', 'Failed'),
    ]

    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='subscriptions')
    pass_type = models.CharField(max_length=30, choices=PASS_TYPES)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    credits_remaining = models.IntegerField(default=0)
    agreement_credits_remaining = models.IntegerField(default=0)
    
    order_id = models.CharField(max_length=100, blank=True, null=True)
    gateway_txn_id = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    
    PAYMENT_CHOICES = [
        ('razorpay', 'Razorpay'),
        ('upi', 'Direct UPI'),
        ('bypass', 'Bypassed')
    ]
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default='razorpay')
    utr = models.CharField(max_length=50, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    extension_used = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.buyer.username} - {self.pass_type} ({self.credits_remaining} credits)"

class IdempotencyKey(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='idempotency_keys')
    key = models.CharField(max_length=255)
    endpoint = models.CharField(max_length=100)
    response_body = models.JSONField()
    status_code = models.IntegerField(default=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'key', 'endpoint'], name='unique_user_key_endpoint')
        ]

    def __str__(self):
        return f"{self.user.username} - {self.endpoint} - {self.key}"

class OwnerListingPass(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owner_listing_passes')
    plan_id = models.CharField(max_length=50, default='3pack') # 'single', '3pack', '6pack', 'custom'
    category = models.CharField(max_length=50, default='all')
    credits_total = models.IntegerField(default=1)
    credits_remaining = models.IntegerField(default=1)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    order_id = models.CharField(max_length=100, blank=True, null=True)
    gateway_txn_id = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, default='active') # 'pending', 'active', 'depleted', 'expired'
    
    PAYMENT_CHOICES = [
        ('razorpay', 'Razorpay'),
        ('upi', 'Direct UPI'),
        ('bypass', 'Bypassed')
    ]
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default='razorpay')
    utr = models.CharField(max_length=50, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.owner.username} Owner Pass: {self.credits_remaining}/{self.credits_total} credits ({self.status})"


class ProcessedWebhookEvent(models.Model):
    """
    Tracks Razorpay webhook events that have been successfully processed.
    Prevents duplicate credit grants when Razorpay retries webhook delivery.
    """
    event_id = models.CharField(max_length=255, unique=True, db_index=True)
    event_type = models.CharField(max_length=100, blank=True)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Processed Webhook Event'
        verbose_name_plural = 'Processed Webhook Events'

    def __str__(self):
        return f"{self.event_type} — {self.event_id} (processed {self.processed_at})"
