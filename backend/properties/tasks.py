from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from properties.models import Property
from notifications.models import Notification

@shared_task
def expire_old_properties():
    now = timezone.now()
    # Find all live properties where expires_at < now
    expired_props = Property.objects.filter(status='live', expires_at__lt=now)
    count = expired_props.update(status='expired')
    return f"Expired {count} properties."

@shared_task
def notify_expiring_properties():
    now = timezone.now()
    three_days_from_now = now + timedelta(days=3)
    
    # Find all live properties expiring within 3 days
    expiring_props = Property.objects.filter(
        status='live', 
        expires_at__gte=now, 
        expires_at__lte=three_days_from_now
    )
    
    count = 0
    for prop in expiring_props:
        # Avoid creating duplicate notifications for the same property if already notified recently
        # A simple check: if a notification for this property was created in the last 3 days
        recent_notification = Notification.objects.filter(
            property=prop,
            recipient=prop.agent,
            created_at__gte=now - timedelta(days=2)
        ).exists()
        
        if not recent_notification:
            Notification.objects.create(
                recipient=prop.agent,
                property=prop,
                message=f"Your listing '{prop.property_type.capitalize()} at {prop.exact_lat}, {prop.exact_lng}' is expiring soon. Please reconfirm availability."
            )
            count += 1
            
    return f"Created {count} notifications for expiring properties."

@shared_task
def notify_saved_searches(property_id):
    try:
        prop = Property.objects.get(id=property_id)
        if prop.status != 'live':
            return "Property is not live."
    except Property.DoesNotExist:
        return "Property does not exist."

    from .models import SavedSearch
    from django.db.models import Q

    # Query matching saved searches
    filters = Q(city=prop.locality.city if prop.locality else None)
    
    # Matching locality or any locality
    locality_filter = Q(locality=prop.locality) | Q(locality__isnull=True)
    
    # Matching property type or any type
    type_filter = Q(property_type=prop.property_type) | Q(property_type__isnull=True) | Q(property_type="")
    
    # Matching price
    min_price_filter = Q(min_price__lte=prop.price) | Q(min_price__isnull=True)
    max_price_filter = Q(max_price__gte=prop.price) | Q(max_price__isnull=True)
    
    matches = SavedSearch.objects.filter(
        filters,
        locality_filter,
        type_filter,
        min_price_filter,
        max_price_filter
    )
    
    count = 0
    for search in matches:
        # Prevent duplicate notifications if already notified for this property
        recent_notification = Notification.objects.filter(
            property=prop,
            recipient=search.buyer
        ).exists()
        
        if not recent_notification:
            Notification.objects.create(
                recipient=search.buyer,
                property=prop,
                message=f"New property match: {prop.property_type.capitalize()} in {prop.locality.name if prop.locality else 'your saved city'} for ₹{prop.price}."
            )
            count += 1
            
    return f"Created {count} notifications for saved searches."
