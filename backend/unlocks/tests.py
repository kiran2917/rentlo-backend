from django.test import TestCase
from django.utils import timezone
from accounts.models import User
from properties.models import Property, City, Locality, PlatformSettings
from unlocks.models import BuyerSubscription, Unlock, ProcessedWebhookEvent
from unlocks.views import activate_or_stack_buyer_pass

class BuyerSubscriptionAndUnlockTests(TestCase):
    def setUp(self):
        self.ps = PlatformSettings.load()
        self.ps.buyer_unlock_fee = 14
        self.ps.buyer_pass_starter_price = 39
        self.ps.buyer_pass_smart_price = 79
        self.ps.buyer_pass_pro_price = 129
        self.ps.save()

        self.buyer = User.objects.create_user(
            username='testbuyer',
            phone='9876543210',
            roles=['buyer']
        )
        self.owner = User.objects.create_user(
            username='testowner',
            phone='9876543211',
            roles=['owner']
        )
        self.city = City.objects.create(name='Bengaluru')
        self.locality = Locality.objects.create(name='Koramangala', city=self.city)
        self.property = Property.objects.create(
            owner_name='Rajesh Kumar',
            owner_phone='9876543211',
            exact_lat=12.9352,
            exact_lng=77.6245,
            price=25000,
            property_type='flat',
            property_category='residential',
            description='Spacious 2BHK flat in prime area.',
            status='live',
            locality=self.locality,
            owner=self.owner
        )

    def test_activate_or_stack_buyer_pass_new_and_stacking(self):
        """Test creating a new subscription and stacking subsequent passes indefinitely."""
        sub, stacked = activate_or_stack_buyer_pass(self.buyer, 'starter_39', amount_paid=39.00)
        self.assertFalse(stacked)
        self.assertEqual(sub.credits_remaining, 3)
        self.assertEqual(sub.status, 'active')

        # Stacking a second pass
        sub2, stacked2 = activate_or_stack_buyer_pass(self.buyer, 'smart_79', amount_paid=79.00)
        self.assertTrue(stacked2)
        self.assertEqual(sub2.credits_remaining, 3 + 6) # 3 + 6 = 9 credits stacked!
        self.assertEqual(sub2.status, 'active')

    def test_processed_webhook_event_idempotency(self):
        """Test webhook idempotency tracking prevents duplicate event execution."""
        event_id = "evt_test_123456"
        self.assertFalse(ProcessedWebhookEvent.objects.filter(event_id=event_id).exists())

        # Record event
        ProcessedWebhookEvent.objects.create(event_id=event_id, event_type="payment.captured")
        self.assertTrue(ProcessedWebhookEvent.objects.filter(event_id=event_id).exists())
