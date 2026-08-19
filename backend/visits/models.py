from django.db import models
from django.conf import settings


class VisitSlot(models.Model):
    property = models.ForeignKey(
        'properties.Property',
        on_delete=models.CASCADE,
        related_name='visit_slots'
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='opened_slots'
    )
    slot_date = models.DateField()
    slot_time = models.TimeField()
    max_bookings = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['slot_date', 'slot_time']

    def __str__(self):
        return f'Slot {self.id} on {self.slot_date}'

    def booking_count(self):
        return self.bookings.filter(status='approved').count()

    def is_full(self):
        return self.bookings.filter(status='approved').count() >= self.max_bookings


class VisitBooking(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    slot = models.ForeignKey(
        VisitSlot,
        on_delete=models.CASCADE,
        related_name='bookings'
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='visit_bookings'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        # removed unique_together because multiple guests can book without a buyer ID

    def __str__(self):
        return f'Booking {self.id} by {self.buyer_id} ({self.status})'
