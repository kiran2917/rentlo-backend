from django.db import models
from django.utils import timezone
from accounts.models import User
from properties.models import Property
from rest_framework import serializers, views, status, permissions
from rest_framework.response import Response

class TenantVerificationRequest(models.Model):
    PACKAGE_CHOICES = [
        ('basic_kyc', 'Basic KYC (Aadhaar & Contact) - ₹199'),
        ('employment_check', 'Employment & Salary Verification - ₹399'),
        ('comprehensive_police', 'Comprehensive Police & Court Check - ₹699'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Document Submission'),
        ('in_review', 'Verification In Progress'),
        ('verified', 'Verified ✓'),
        ('flagged', 'Discrepancy / Flagged ⚠'),
        ('rejected', 'Rejected'),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tenant_verifications_ordered')
    property = models.ForeignKey(Property, on_delete=models.SET_NULL, null=True, blank=True, related_name='tenant_verifications')
    
    tenant_name = models.CharField(max_length=255)
    tenant_phone = models.CharField(max_length=20)
    tenant_email = models.EmailField(blank=True, null=True)
    
    package_type = models.CharField(max_length=50, choices=PACKAGE_CHOICES, default='basic_kyc')
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=199.00)
    
    # Document details
    id_proof_type = models.CharField(max_length=50, default='aadhaar')
    id_proof_number = models.CharField(max_length=50, blank=True, null=True)
    id_proof_url = models.URLField(max_length=500, blank=True, null=True)
    
    employer_name = models.CharField(max_length=255, blank=True, null=True)
    designation = models.CharField(max_length=255, blank=True, null=True)
    salary_slip_url = models.URLField(max_length=500, blank=True, null=True)
    
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    verification_score = models.IntegerField(default=95, help_text="Trust Score out of 100")
    report_notes = models.TextField(blank=True, null=True)
    certificate_id = models.CharField(max_length=50, blank=True, null=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.certificate_id and self.id:
            self.certificate_id = f"RL-KYC-{self.id:06d}"
        super().save(*args, **kwargs)
        if not self.certificate_id:
            self.certificate_id = f"RL-KYC-{self.id:06d}"
            super().save(update_fields=['certificate_id'])

    def __str__(self):
        return f"{self.tenant_name} ({self.status}) - {self.certificate_id}"


class TenantVerificationSerializer(serializers.ModelSerializer):
    property_title = serializers.CharField(source='property.title', read_only=True)
    
    class Meta:
        model = TenantVerificationRequest
        fields = '__all__'
        read_only_fields = ['owner', 'certificate_id', 'created_at', 'verified_at']


class TenantKYCListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        
        if 'admin' in roles or 'moderator' in roles:
            verifications = TenantVerificationRequest.objects.all().select_related('owner', 'property')
        else:
            verifications = TenantVerificationRequest.objects.filter(owner=user).select_related('property')
            
        serializer = TenantVerificationSerializer(verifications, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TenantVerificationSerializer(data=request.data)
        if serializer.is_valid():
            package = serializer.validated_data.get('package_type', 'basic_kyc')
            price_map = {'basic_kyc': 199.00, 'employment_check': 399.00, 'comprehensive_police': 699.00}
            amount = price_map.get(package, 199.00)
            
            # Save with owner
            instance = serializer.save(
                owner=request.user,
                amount_paid=amount,
                status='in_review'
            )
            return Response(TenantVerificationSerializer(instance).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TenantKYCDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            instance = TenantVerificationRequest.objects.get(pk=pk)
        except TenantVerificationRequest.DoesNotExist:
            return Response({'detail': 'Verification request not found'}, status=status.HTTP_404_NOT_FOUND)
            
        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        if 'admin' not in roles and instance.owner != user:
            return Response({'detail': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
            
        return Response(TenantVerificationSerializer(instance).data)

    def patch(self, request, pk):
        try:
            instance = TenantVerificationRequest.objects.get(pk=pk)
        except TenantVerificationRequest.DoesNotExist:
            return Response({'detail': 'Verification request not found'}, status=status.HTTP_404_NOT_FOUND)
            
        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        if 'admin' not in roles and instance.owner != user:
            return Response({'detail': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        serializer = TenantVerificationSerializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            if request.data.get('status') == 'verified' and not instance.verified_at:
                serializer.save(verified_at=timezone.now())
            else:
                serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
