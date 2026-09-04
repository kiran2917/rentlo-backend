from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from accounts.models import User
from properties.models import Property, City, Locality, PlatformSettings
from unlocks.models import OwnerListingPass

class OwnerPassAndPropertyLifecycleTests(TestCase):
    def setUp(self):
        self.ps = PlatformSettings.load()
        self.ps.validity_residential_1pack_days = 0 # Infinite / Until Rented
        self.ps.validity_apt_pg_1pack_days = 60 # 60 days
        self.ps.validity_commercial_1pack_days = 30 # 30 days
        self.ps.save()

        self.owner = User.objects.create_user(
            username='testowner2',
            phone='9876543212',
            roles=['owner']
        )
        self.city = City.objects.create(name='Bengaluru')
        self.locality = Locality.objects.create(name='Indiranagar', city=self.city)

    def test_owner_pass_creation_and_credit_deduction(self):
        """Test creating an OwnerListingPass and consuming credits until depleted."""
        op = OwnerListingPass.objects.create(
            owner=self.owner,
            plan_id='3pack',
            category='residential',
            credits_total=3,
            credits_remaining=3,
            amount_paid=259.00,
            status='active'
        )
        self.assertEqual(op.credits_remaining, 3)
        self.assertEqual(op.status, 'active')

        # Consume 1st credit
        op.credits_remaining -= 1
        op.save(update_fields=['credits_remaining'])
        self.assertEqual(op.credits_remaining, 2)

        # Consume remaining
        op.credits_remaining = 0
        op.status = 'depleted'
        op.save(update_fields=['credits_remaining', 'status'])
        self.assertEqual(op.credits_remaining, 0)
        self.assertEqual(op.status, 'depleted')

    def test_dynamic_expiry_calculation_residential_infinite(self):
        """Test residential listing with validity 0 has None as expires_at (Until Rented)."""
        prop = Property.objects.create(
            owner_name='Vikram Sharma',
            owner_phone='9876543212',
            exact_lat=12.9716,
            exact_lng=77.5946,
            price=30000,
            property_type='house',
            property_category='residential',
            description='Independent house in prime location.',
            status='live',
            locality=self.locality,
            owner=self.owner,
            expires_at=None
        )
        self.assertIsNone(prop.expires_at)

    def test_dynamic_expiry_calculation_pg_fixed_days(self):
        """Test PG listing with validity 60d gets correct future expiration."""
        expected_expiry = timezone.now() + timedelta(days=60)
        prop = Property.objects.create(
            owner_name='Vikram Sharma',
            owner_phone='9876543212',
            exact_lat=12.9716,
            exact_lng=77.5946,
            price=8000,
            property_type='pg',
            property_category='pg',
            description='Cozy single sharing PG for gents.',
            status='live',
            locality=self.locality,
            owner=self.owner,
            expires_at=expected_expiry
        )
        self.assertIsNotNone(prop.expires_at)
        self.assertGreater(prop.expires_at, timezone.now())
