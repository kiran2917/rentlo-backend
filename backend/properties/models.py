from django.db import models
from accounts.models import User

class City(models.Model):
    name = models.CharField(max_length=255)
    state = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    unlock_price = models.DecimalField(max_digits=10, decimal_places=2, default=14.00)
    registration_fee = models.DecimalField(max_digits=10, decimal_places=2, default=500.00)

    def __str__(self):
        return f"{self.name}, {self.state}"

class Locality(models.Model):
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='localities')
    name = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.name} ({self.city.name})"
class Property(models.Model):
    PROPERTY_CATEGORY_CHOICES = [
        ('residential', 'Residential'),
        ('pg', 'PG / Co-Living'),
        ('commercial', 'Commercial'),
    ]
    PROPERTY_TYPES = [
        # Residential
        ('apartment', 'Apartment / Flat'),
        ('house', 'Independent House / Villa'),
        ('builder_floor', 'Builder Floor'),
        ('studio', '1 RK / Studio Apartment'),
        ('1bhk', '1 BHK Apartment / House'),
        ('2bhk', '2 BHK Apartment / House'),
        ('3bhk', '3 BHK Apartment / House'),
        ('4bhk', '4 BHK Apartment / House'),
        ('5bhk', '5+ BHK / Luxury Villa'),
        ('pg', 'PG / Co-living'),
        ('pg_hostel', 'Full Co-Living Hostel / PG Building'),
        ('pg_single', 'Single Occupancy PG Room'),
        ('pg_double', 'Double Sharing PG Room'),
        ('pg_triple', 'Triple+ Sharing PG Room'),
        # Commercial
        ('office', 'Office Space'),
        ('retail', 'Retail Shop / Showroom'),
        ('warehouse', 'Warehouse / Godown'),
        ('coworking', 'Co-working Space'),
        ('industrial', 'Industrial Shed / Building'),
        # Legacy
        ('plot', 'Plot'),
        ('commercial', 'Commercial'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('live', 'Live'),
        ('under_negotiation', 'Under Negotiation'),
        ('sold', 'Sold'),
        ('rented', 'Rented'),
        ('expired', 'Expired'),
        ('rejected', 'Rejected'),
    ]

    agent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='agent_properties', null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_properties', null=True, blank=True)
    added_by = models.CharField(max_length=50, default='self')
    
    VERIFICATION_CHOICES = [
        ('pending_docs', 'Pending Documents'),
        ('pending_review', 'Pending Review'),
        ('verified', 'Verified')
    ]
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default='pending_docs')
    ownership_document = models.FileField(upload_to='ownership_docs/', null=True, blank=True)

    owner_name = models.CharField(max_length=255)
    owner_phone = models.CharField(max_length=20)
    has_whatsapp = models.BooleanField(default=True)
    
    locality = models.ForeignKey(Locality, on_delete=models.SET_NULL, null=True, blank=True, related_name='properties')
    
    exact_lat = models.DecimalField(max_digits=10, decimal_places=8)
    exact_lng = models.DecimalField(max_digits=11, decimal_places=8)
    exact_address = models.TextField(null=True, blank=True)
    
    price = models.DecimalField(max_digits=14, decimal_places=2)
    property_category = models.CharField(max_length=20, choices=PROPERTY_CATEGORY_CHOICES, default='residential')
    property_type = models.CharField(max_length=20, choices=PROPERTY_TYPES)
    description = models.TextField()
    
    # Property Deep-Dive Details
    bedrooms = models.IntegerField(null=True, blank=True)
    bathrooms = models.IntegerField(null=True, blank=True)
    balconies = models.IntegerField(null=True, blank=True)
    carpet_area = models.IntegerField(null=True, blank=True, help_text="Carpet area in Sq.Ft.")
    
    FURNISHING_CHOICES = [('unfurnished', 'Unfurnished'), ('semi', 'Semi-Furnished'), ('fully', 'Fully-Furnished')]
    furnishing_status = models.CharField(max_length=20, choices=FURNISHING_CHOICES, null=True, blank=True)
    
    facing_direction = models.CharField(max_length=50, null=True, blank=True)
    total_floors = models.IntegerField(null=True, blank=True)
    floor_number = models.IntegerField(null=True, blank=True)
    
    # House & PG Building Details
    HOUSE_FLOOR_CHOICES = [
        ('ground', 'Ground Floor'),
        ('1st', '1st Floor'),
        ('2nd', '2nd Floor'),
        ('3rd_plus', '3rd Floor & Above'),
        ('entire_house', 'Entire House / All Floors')
    ]
    house_floor = models.CharField(max_length=20, choices=HOUSE_FLOOR_CHOICES, null=True, blank=True)

    PG_GENDER_CHOICES = [
        ('boys', 'Boys / Male Only'),
        ('girls', 'Girls / Female Only'),
        ('coliving', 'Co-Living / Unisex')
    ]
    pg_gender = models.CharField(max_length=20, choices=PG_GENDER_CHOICES, null=True, blank=True)

    PG_SHARING_CHOICES = [
        ('single', 'Single Private Room'),
        ('double', 'Double Sharing'),
        ('triple_plus', '3+ Bed Sharing')
    ]
    pg_sharing_type = models.CharField(max_length=20, choices=PG_SHARING_CHOICES, null=True, blank=True)

    total_beds = models.IntegerField(default=0, null=True, blank=True)
    available_beds = models.IntegerField(default=0, null=True, blank=True)

    # Boost & Visibility Flags
    is_featured = models.BooleanField(default=False)
    is_hero_spotlight = models.BooleanField(default=False)
    
    # Registration Payment Details
    REGISTRATION_PAYMENT_CHOICES = [
        ('cash', 'Cash'),
        ('upi', 'UPI'),
        ('razorpay', 'Razorpay'),
    ]
    registration_payment_method = models.CharField(max_length=20, choices=REGISTRATION_PAYMENT_CHOICES, null=True, blank=True)
    registration_fee_paid = models.BooleanField(default=False)
    registration_utr = models.CharField(max_length=50, null=True, blank=True)
    registration_razorpay_order_id = models.CharField(max_length=100, null=True, blank=True)
    registration_razorpay_payment_id = models.CharField(max_length=100, null=True, blank=True)
    registration_razorpay_signature = models.CharField(max_length=255, null=True, blank=True)
    property_age = models.IntegerField(null=True, blank=True, help_text="Age in years")
    
    security_deposit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    maintenance_charges = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    available_from = models.DateField(null=True, blank=True)
    
    TENANT_CHOICES = [
        ('any', 'Any'),
        ('family', 'Family Only'),
        ('bachelors', 'Bachelors Allowed'),
        ('only_boys', 'Boys Only'),
        ('only_girls', 'Girls Only'),
        ('company', 'Company Lease'),
    ]
    preferred_tenants = models.CharField(max_length=20, choices=TENANT_CHOICES, default='any')
    
    FOOD_CHOICES = [
        ('any', 'Any Food'),
        ('veg_only', 'Veg Only'),
        ('non_veg_allowed', 'Non-Veg Allowed'),
    ]
    food_preference = models.CharField(max_length=20, choices=FOOD_CHOICES, default='any', null=True, blank=True)
    
    PET_CHOICES = [('allowed', 'Allowed'), ('not_allowed', 'Not Allowed')]
    pet_policy = models.CharField(max_length=20, choices=PET_CHOICES, default='not_allowed')
    
    amenities = models.JSONField(default=list, blank=True)
    
    # [NEW] General Finance & Lease
    maintenance_included_in_rent = models.BooleanField(default=False)
    lock_in_period_months = models.IntegerField(null=True, blank=True)
    lease_term_months = models.IntegerField(null=True, blank=True)

    # [NEW] Residential Specs
    super_built_up_area = models.IntegerField(null=True, blank=True, help_text="Super built-up area in Sq.Ft.")
    covered_parking_spots = models.IntegerField(default=0)
    open_parking_spots = models.IntegerField(default=0)
    
    POWER_BACKUP_CHOICES = [('full', 'Full'), ('partial', 'Partial'), ('none', 'None')]
    power_backup = models.CharField(max_length=20, choices=POWER_BACKUP_CHOICES, null=True, blank=True)
    
    WATER_SUPPLY_CHOICES = [('24x7', '24/7 Water'), ('corporation', 'Corporation'), ('borewell', 'Borewell')]
    water_supply = models.CharField(max_length=20, choices=WATER_SUPPLY_CHOICES, null=True, blank=True)
    gated_security = models.BooleanField(default=False)

    # [NEW] PG Specs
    PG_SHARING_CHOICES = [('single', 'Single'), ('double', 'Double'), ('triple', 'Triple'), ('four_plus', 'Four+')]
    pg_sharing_type = models.CharField(max_length=20, choices=PG_SHARING_CHOICES, null=True, blank=True)
    pg_attached_washroom = models.BooleanField(default=False)
    pg_food_provided = models.JSONField(default=list, blank=True)  # ['Breakfast', 'Lunch', 'Dinner']
    pg_amenities = models.JSONField(default=list, blank=True)
    pg_rules = models.JSONField(default=dict, blank=True)  # {'non_veg': True, 'curfew': '10 PM', etc.}

    # [NEW] Commercial Specs
    COMMERCIAL_BUILDING_CHOICES = [('independent', 'Independent Building'), ('business_park', 'Business Park'), ('complex', 'Commercial Complex')]
    commercial_building_type = models.CharField(max_length=30, choices=COMMERCIAL_BUILDING_CHOICES, null=True, blank=True)
    
    COMMERCIAL_WASHROOM_CHOICES = [('private', 'Private'), ('shared', 'Shared'), ('none', 'None')]
    commercial_washrooms = models.CharField(max_length=20, choices=COMMERCIAL_WASHROOM_CHOICES, null=True, blank=True)
    
    COMMERCIAL_PANTRY_CHOICES = [('wet', 'Wet Pantry'), ('dry', 'Dry Pantry'), ('none', 'None')]
    commercial_pantry = models.CharField(max_length=20, choices=COMMERCIAL_PANTRY_CHOICES, null=True, blank=True)
    
    commercial_central_ac = models.BooleanField(default=False)
    retail_frontage_feet = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    warehouse_ceiling_height_feet = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    warehouse_floor_load_capacity = models.CharField(max_length=100, null=True, blank=True)
    industrial_power_capacity_kw = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    heavy_vehicle_access = models.BooleanField(default=False)
    
    unlock_fee = models.DecimalField(max_digits=10, decimal_places=2, default=99.00)
    onboarding_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    onboarding_payment_method = models.CharField(max_length=20, choices=[('cash', 'Cash'), ('qr', 'QR Code'), ('razorpay', 'Razorpay')], null=True, blank=True)
    onboarding_payment_status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('paid', 'Paid')], default='pending')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    under_negotiation_since = models.DateTimeField(null=True, blank=True)
    consent_proof_url = models.URLField(max_length=500, blank=True, null=True)
    voice_note_url = models.URLField(max_length=500, blank=True, null=True)
    virtual_tour_url = models.URLField(max_length=500, blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    duplicate_of = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='duplicates')

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['agent']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.property_type.capitalize()} at {self.exact_lat}, {self.exact_lng} ({self.status})"

class ConsentOTP(models.Model):
    phone = models.CharField(max_length=20)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return f"OTP for {self.phone} (Used: {self.is_used})"

class OTPVerification(models.Model):
    # This is for buyer OTP verification without forcing account creation initially
    phone = models.CharField(max_length=20, unique=True)
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.phone} - {self.code}"

class SavedSearch(models.Model):
    buyer = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='saved_searches')
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    locality = models.ForeignKey(Locality, on_delete=models.CASCADE, null=True, blank=True)
    property_type = models.CharField(max_length=20, choices=Property.PROPERTY_TYPES, null=True, blank=True)
    min_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Saved Search by {self.buyer.username} for {self.city.name}"

class PlatformSettingsAuditLog(models.Model):
    changed_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)
    field_name = models.CharField(max_length=100)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.field_name} changed by {self.changed_by} at {self.changed_at}"

class PlatformSettings(models.Model):
    default_upi_id = models.CharField(max_length=255, default='rentlo@ybl')
    
    # Dynamic Buyer Unlock & Pass Prices
    buyer_unlock_fee = models.DecimalField(max_digits=10, decimal_places=2, default=14.00)
    buyer_pass_starter_price = models.DecimalField(max_digits=10, decimal_places=2, default=39.00)
    buyer_pass_smart_price = models.DecimalField(max_digits=10, decimal_places=2, default=79.00)
    buyer_pass_pro_price = models.DecimalField(max_digits=10, decimal_places=2, default=129.00)

    # Dynamic Owner Listing Fees & Passes by Category
    owner_residential_fee = models.DecimalField(max_digits=10, decimal_places=2, default=99.00)
    owner_residential_3pack_price = models.DecimalField(max_digits=10, decimal_places=2, default=259.00)
    owner_residential_6pack_price = models.DecimalField(max_digits=10, decimal_places=2, default=499.00)
    owner_residential_10pack_price = models.DecimalField(max_digits=10, decimal_places=2, default=859.00)

    owner_apt_pg_fee = models.DecimalField(max_digits=10, decimal_places=2, default=149.00)
    owner_apt_pg_3pack_price = models.DecimalField(max_digits=10, decimal_places=2, default=349.00)
    owner_apt_pg_6pack_price = models.DecimalField(max_digits=10, decimal_places=2, default=649.00)
    owner_apt_pg_10pack_price = models.DecimalField(max_digits=10, decimal_places=2, default=999.00)

    owner_commercial_fee = models.DecimalField(max_digits=10, decimal_places=2, default=199.00)
    owner_commercial_3pack_price = models.DecimalField(max_digits=10, decimal_places=2, default=449.00)
    owner_commercial_6pack_price = models.DecimalField(max_digits=10, decimal_places=2, default=799.00)
    owner_commercial_10pack_price = models.DecimalField(max_digits=10, decimal_places=2, default=1199.00)

    owner_combo_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)

    owner_onboarding_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    bypass_buyer_payment = models.BooleanField(default=False)
    bypass_owner_payment = models.BooleanField(default=False)
    
    buyer_require_otp_login = models.BooleanField(default=False)
    buyer_require_otp_signup = models.BooleanField(default=True)
    owner_require_otp_login = models.BooleanField(default=False)
    owner_require_otp_signup = models.BooleanField(default=True)
    agent_require_otp_login = models.BooleanField(default=False)
    agent_require_otp_signup = models.BooleanField(default=True)
    admin_require_otp_login = models.BooleanField(default=False)
    admin_require_otp_signup = models.BooleanField(default=True)
    otp_bypass_enabled = models.BooleanField(default=False)
    
    GATEWAY_CHOICES = [
        ('upi', 'Direct UPI'),
        ('razorpay', 'Razorpay'),
    ]
    buyer_payment_gateway = models.CharField(max_length=20, choices=GATEWAY_CHOICES, default='razorpay')
    owner_payment_gateway = models.CharField(max_length=20, choices=GATEWAY_CHOICES, default='upi')
    agent_payment_gateway = models.CharField(max_length=20, choices=GATEWAY_CHOICES, default='upi')
    admin_payment_gateway = models.CharField(max_length=20, choices=GATEWAY_CHOICES, default='upi')

    THEME_CHOICES = [
        ('warm_luxury', 'Warm Luxury'),
        ('midnight_glass', 'Midnight Glass'),
        ('emerald_minimal', 'Emerald Minimal'),
        ('sapphire_luxury', 'Royal Sapphire Indigo'),
        ('midnight_cyber', 'Obsidian Cyber Dark'),
        ('graffiti_street', 'Graffiti Street Art'),
        
        ('graffiti_pink', 'Graffiti Pink Asphalt'),
        ('graffiti_lime', 'Graffiti Lime Purple'),
        ('graffiti_cyan', 'Graffiti Cyan Orange'),
        
        ('glass_emerald', 'Glassmorphism Emerald'),
        ('glass_sapphire', 'Glassmorphism Sapphire'),
        ('glass_crimson', 'Glassmorphism Crimson'),
        
        ('clay_blue', 'Claymorphism Pastel Blue'),
        ('clay_peach', 'Claymorphism Pastel Peach'),
        ('clay_sage', 'Claymorphism Pastel Sage'),

        ('bento_cyber', 'Cyber Obsidian Bento'),
        ('bento_slate', 'Soft Slate Bento'),
        ('bento_amber', 'Royal Amber Bento'),

        ('luxury_champagne', 'Classic Champagne'),
        ('luxury_forest', 'Forest Regency'),
        ('luxury_terracotta', 'Warm Terracotta'),

        ('brutal_pink', 'Retro Pop Pink'),
        ('brutal_citrus', 'Cyber Citrus'),
        ('brutal_violet', 'Electric Violet'),

        ('cyber_magenta', 'Cyber Magenta'),
        ('cyber_cyan', 'Cyber Cyan'),
        ('cyber_sunset', 'Synthwave Sunset'),

        ('neumorphic_pearl', 'Soft Pearl Neumorphic'),
        ('neumorphic_obsidian', 'Obsidian Neumorphic'),
        ('neumorphic_sage', 'Sage Neumorphic'),
    ]
    theme = models.CharField(max_length=50, choices=THEME_CHOICES, default='warm_luxury')
    buyer_theme = models.CharField(max_length=50, choices=THEME_CHOICES, default='warm_luxury')
    dashboard_theme = models.CharField(max_length=50, choices=THEME_CHOICES, default='emerald_minimal')

    # E-Stamp & Aadhaar E-Sign Feature Toggle (Phase 2)
    enable_e_stamp_agreements = models.BooleanField(default=False)
    e_stamp_price = models.DecimalField(max_digits=10, decimal_places=2, default=499.00)
    e_stamp_provider = models.CharField(
        max_length=50, 
        default='digio',
        choices=[('digio', 'Digio API'), ('signzy', 'Signzy API'), ('leegality', 'Leegality API')]
    )
    e_stamp_api_key = models.CharField(max_length=255, blank=True, default='')
    e_stamp_api_secret = models.CharField(max_length=255, blank=True, default='')

    # Owner Listing Verification Method (for staff-initiated listings)
    OWNER_LISTING_VERIFICATION_CHOICES = [
        ('otp', 'OTP Verification'),
        ('selfie', 'Live Selfie Capture'),
    ]
    owner_listing_verification_method = models.CharField(
        max_length=10,
        choices=OWNER_LISTING_VERIFICATION_CHOICES,
        default='otp',
        help_text="Verification method required when staff registers a property on behalf of an owner."
    )

    # ─── Payment Gateway: Razorpay ───────────────────────────────────────────
    razorpay_key_id = models.CharField(max_length=100, blank=True, default='',
        help_text="Razorpay Key ID (e.g. rzp_test_... or rzp_live_...)")
    razorpay_key_secret = models.CharField(max_length=255, blank=True, default='',
        help_text="Razorpay Key Secret — never exposed in API responses")
    razorpay_webhook_secret = models.CharField(max_length=255, blank=True, default='',
        help_text="Razorpay Webhook Secret — never exposed in API responses")

    # ─── SMS / OTP Provider ───────────────────────────────────────────────────
    SMS_PROVIDER_CHOICES = [
        ('none',      'None (Demo mode — use 000000)'),
        ('exotel',    'Exotel'),
        ('twilio',    'Twilio'),
        ('msg91',     'MSG91'),
        ('fast2sms',  'Fast2SMS'),
        ('textlocal', 'TextLocal'),
    ]
    sms_provider = models.CharField(max_length=20, choices=SMS_PROVIDER_CHOICES, default='none',
        help_text="Active SMS gateway for OTP delivery")
    sms_api_key = models.CharField(max_length=255, blank=True, default='',
        help_text="API Key / Account SID / Auth Key for the SMS provider")
    sms_api_secret = models.CharField(max_length=255, blank=True, default='',
        help_text="API Secret / Auth Token — never exposed in API responses")
    sms_sender_id = models.CharField(max_length=20, blank=True, default='',
        help_text="Sender ID shown to recipient (e.g. RENTLO)")
    sms_template_id = models.CharField(max_length=50, blank=True, default='',
        help_text="DLT Template ID (required for Indian carriers via MSG91 / Fast2SMS)")
    sms_from_number = models.CharField(max_length=20, blank=True, default='',
        help_text="Twilio: From phone number (e.g. +1XXXXXXXXXX)")

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Platform Settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def requires_otp(self, role: str, is_signup: bool) -> bool:
        """
        Returns whether OTP is required for the given role and scenario.
        Defaults to True for safety if the role is not mapped explicitly.
        """
        prefix = role.lower()
        if prefix not in ['buyer', 'owner', 'agent', 'admin']:
            prefix = 'buyer'  # fallback
            
        attr_name = f"{prefix}_require_otp_{'signup' if is_signup else 'login'}"
        return getattr(self, attr_name, True)
