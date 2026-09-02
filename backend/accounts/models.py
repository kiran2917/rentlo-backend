from django.contrib.auth.models import AbstractUser
from django.db import models
from encrypted_model_fields.fields import EncryptedCharField

class User(AbstractUser):

    roles = models.JSONField(default=list, blank=True)
    is_phone_verified = models.BooleanField(default=False)
    force_password_change = models.BooleanField(default=False)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    has_whatsapp = models.BooleanField(default=True)
    fraud_flag_count = models.IntegerField(default=0)
    assigned_cities = models.ManyToManyField('properties.City', blank=True, related_name='assigned_users')
    sub_admin_permissions = models.JSONField(default=dict, blank=True)
    
    ownership_document_url = models.TextField(blank=True, null=True)
    owner_kyc_status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('submitted', 'Submitted'), ('verified', 'Verified'), ('rejected', 'Rejected')], default='pending')

    # DPDP Act 2023 Technical Baseline Fields
    dpdp_consent_given = models.BooleanField(default=False)
    dpdp_consent_timestamp = models.DateTimeField(null=True, blank=True)
    dpdp_consent_version = models.CharField(max_length=20, default='1.0')

    def __str__(self):
        return f"{self.username} ({', '.join(self.roles) if self.roles else 'no-role'})"

    @property
    def role(self):
        if self.is_superuser or self.is_staff or 'admin' in (self.roles or []):
            return 'admin'
        if 'owner' in (self.roles or []) or (hasattr(self, 'owned_properties') and self.owned_properties.exists()):
            return 'owner'
        if 'agent' in (self.roles or []):
            return 'agent'
        return self.roles[0] if self.roles else 'buyer'


class AdminSettingsVault(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings_vault')
    password_hash = models.CharField(max_length=255)
    admin_phone = models.CharField(max_length=20)
    security_question = models.CharField(max_length=255)
    security_answer_hash = models.CharField(max_length=255)
    is_configured = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def set_password(self, raw_password):
        from django.contrib.auth.hashers import make_password
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password_hash)

    def set_security_answer(self, raw_answer):
        from django.contrib.auth.hashers import make_password
        self.security_answer_hash = make_password(raw_answer.strip().lower())

    def check_security_answer(self, raw_answer):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_answer.strip().lower(), self.security_answer_hash)

    def __str__(self):
        return f"Vault for {self.user.username}"


class AgentKYC(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Verification'),
        ('submitted', 'Submitted - Under Review'),
        ('verified', 'Verified Partner'),
        ('rejected', 'Verification Rejected'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='kyc')
    
    # Karnataka Verification Documents
    aadhaar_number = EncryptedCharField(max_length=16, blank=True, null=True)
    aadhaar_front_url = models.TextField(blank=True, null=True)
    aadhaar_back_url = models.TextField(blank=True, null=True)
    
    pan_number = EncryptedCharField(max_length=20, blank=True, null=True)
    pan_card_url = models.TextField(blank=True, null=True)
    
    karnataka_rera_no = models.CharField(max_length=100, blank=True, null=True)
    driving_license_no = models.CharField(max_length=50, blank=True, null=True)
    selfie_url = models.TextField(blank=True, null=True)
    
    # Payout & Banking Details
    upi_id = EncryptedCharField(max_length=255, blank=True, null=True)
    account_holder_name = models.CharField(max_length=255, blank=True, null=True)
    bank_account_number = EncryptedCharField(max_length=100, blank=True, null=True)
    ifsc_code = EncryptedCharField(max_length=20, blank=True, null=True)
    bank_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Verification Meta
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_kycs')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"KYC for {self.user.username} ({self.get_status_display()})"


class PushSubscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Push Subscription for {self.user.username} ({self.id})"


