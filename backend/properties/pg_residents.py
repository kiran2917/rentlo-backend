from django.db import models
from django.utils import timezone
from accounts.models import User
from properties.models import Property
from rest_framework import serializers, views, status, permissions
from rest_framework.response import Response

class PGResident(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active Resident'),
        ('notice_period', 'Serving Notice Period (30 Days)'),
        ('vacated', 'Vacated / Checked Out'),
    ]

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='pg_residents')
    
    resident_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    
    room_number = models.CharField(max_length=50, help_text="e.g. 101, 204")
    bed_number = models.CharField(max_length=50, help_text="e.g. Bed A, Bed B, Single")
    
    monthly_rent = models.DecimalField(max_digits=10, decimal_places=2)
    security_deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    deposit_paid = models.BooleanField(default=True)
    
    check_in_date = models.DateField(default=timezone.now)
    check_out_date = models.DateField(null=True, blank=True)
    
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='active')
    
    # Food & Amenities
    mess_opted = models.BooleanField(default=True, help_text="Opted for monthly mess/meals")
    mess_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Verification
    id_proof_type = models.CharField(max_length=50, default='aadhaar')
    id_proof_url = models.URLField(max_length=500, blank=True, null=True)
    
    emergency_contact_name = models.CharField(max_length=255, blank=True, null=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True, null=True)
    
    last_rent_paid_month = models.CharField(max_length=50, blank=True, null=True, help_text="e.g. August 2026")
    notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['room_number', 'bed_number', '-created_at']

    def __str__(self):
        return f"{self.resident_name} (Room {self.room_number}-{self.bed_number}) - {self.property.title}"


class PGResidentSerializer(serializers.ModelSerializer):
    property_title = serializers.CharField(source='property.title', read_only=True)
    property_address = serializers.CharField(source='property.address', read_only=True)

    class Meta:
        model = PGResident
        fields = '__all__'


class PGResidentListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        property_id = request.query_params.get('property_id')

        qs = PGResident.objects.all().select_related('property')
        if 'admin' not in roles:
            qs = qs.filter(property__owner=user)
            
        if property_id:
            qs = qs.filter(property_id=property_id)
            
        serializer = PGResidentSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        property_id = request.data.get('property')
        try:
            prop = Property.objects.get(pk=property_id)
        except Property.DoesNotExist:
            return Response({'detail': 'Property not found'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        if 'admin' not in roles and prop.owner != user and prop.agent != user:
            return Response({'detail': 'Unauthorized for this property'}, status=status.HTTP_403_FORBIDDEN)

        serializer = PGResidentSerializer(data=request.data)
        if serializer.is_valid():
            resident = serializer.save()
            # Update property available beds automatically
            active_residents_count = PGResident.objects.filter(property=prop, status='active').count()
            if prop.total_beds and prop.total_beds > 0:
                prop.available_beds = max(0, prop.total_beds - active_residents_count)
                prop.save(update_fields=['available_beds'])
                
            return Response(PGResidentSerializer(resident).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PGResidentDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            resident = PGResident.objects.get(pk=pk)
        except PGResident.DoesNotExist:
            return Response({'detail': 'Resident not found'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        if 'admin' not in roles and resident.property.owner != user:
            return Response({'detail': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        return Response(PGResidentSerializer(resident).data)

    def patch(self, request, pk):
        try:
            resident = PGResident.objects.get(pk=pk)
        except PGResident.DoesNotExist:
            return Response({'detail': 'Resident not found'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        if 'admin' not in roles and resident.property.owner != user:
            return Response({'detail': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        serializer = PGResidentSerializer(resident, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            # Recalculate beds
            prop = resident.property
            active_count = PGResident.objects.filter(property=prop, status='active').count()
            if prop.total_beds and prop.total_beds > 0:
                prop.available_beds = max(0, prop.total_beds - active_count)
                prop.save(update_fields=['available_beds'])
            return Response(PGResidentSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            resident = PGResident.objects.get(pk=pk)
        except PGResident.DoesNotExist:
            return Response({'detail': 'Resident not found'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        if 'admin' not in roles and resident.property.owner != user:
            return Response({'detail': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        prop = resident.property
        resident.delete()
        active_count = PGResident.objects.filter(property=prop, status='active').count()
        if prop.total_beds and prop.total_beds > 0:
            prop.available_beds = max(0, prop.total_beds - active_count)
            prop.save(update_fields=['available_beds'])

        return Response({'detail': 'Resident deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
