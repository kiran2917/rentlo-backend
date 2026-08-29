from django.db import models
from django.utils import timezone
from accounts.models import User
from properties.models import Property
from rest_framework import serializers, views, status, permissions
from rest_framework.response import Response

class MaintenanceTicket(models.Model):
    CATEGORY_CHOICES = [
        ('plumbing', 'Plumbing / Water Leakage'),
        ('electrical', 'Electrical / Power Issue'),
        ('appliance', 'Appliance (Geyser, AC, Fan)'),
        ('carpentry', 'Carpentry / Door / Locks'),
        ('painting', 'Painting & Wall Seepage'),
        ('cleaning', 'Pest Control & Deep Cleaning'),
        ('other', 'Other General Repair'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low (Routine)'),
        ('medium', 'Medium (Standard)'),
        ('high', 'High (Urgent)'),
        ('emergency', 'Emergency (Immediate Action)'),
    ]

    STATUS_CHOICES = [
        ('open', 'Open / Reported'),
        ('assigned', 'Vendor Assigned'),
        ('in_progress', 'Repair In Progress'),
        ('resolved', 'Resolved ✓'),
        ('cancelled', 'Cancelled'),
    ]

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='maintenance_tickets')
    raised_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets_raised')
    
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='plumbing')
    priority = models.CharField(max_length=30, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='open')
    
    photo_url = models.URLField(max_length=500, blank=True, null=True)
    
    # Vendor / Technician details
    assigned_vendor_name = models.CharField(max_length=255, blank=True, null=True)
    assigned_vendor_phone = models.CharField(max_length=20, blank=True, null=True)
    
    # Financials
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    actual_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    invoice_url = models.URLField(max_length=500, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title} ({self.status}) - {self.property.title}"


class MaintenanceTicketSerializer(serializers.ModelSerializer):
    property_title = serializers.CharField(source='property.title', read_only=True)
    property_locality = serializers.CharField(source='property.locality.name', read_only=True)
    raised_by_name = serializers.CharField(source='raised_by.username', read_only=True)

    class Meta:
        model = MaintenanceTicket
        fields = '__all__'


class MaintenanceTicketListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        property_id = request.query_params.get('property_id')

        if 'admin' in roles:
            qs = MaintenanceTicket.objects.all().select_related('property', 'raised_by')
        else:
            qs = MaintenanceTicket.objects.filter(
                models.Q(property__owner=user) | models.Q(raised_by=user)
            ).select_related('property', 'raised_by')

        if property_id:
            qs = qs.filter(property_id=property_id)

        serializer = MaintenanceTicketSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        property_id = request.data.get('property')
        try:
            prop = Property.objects.get(pk=property_id)
        except Property.DoesNotExist:
            return Response({'detail': 'Property not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = MaintenanceTicketSerializer(data=request.data)
        if serializer.is_valid():
            ticket = serializer.save(raised_by=request.user)
            return Response(MaintenanceTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MaintenanceTicketDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            ticket = MaintenanceTicket.objects.get(pk=pk)
        except MaintenanceTicket.DoesNotExist:
            return Response({'detail': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response(MaintenanceTicketSerializer(ticket).data)

    def patch(self, request, pk):
        try:
            ticket = MaintenanceTicket.objects.get(pk=pk)
        except MaintenanceTicket.DoesNotExist:
            return Response({'detail': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = MaintenanceTicketSerializer(ticket, data=request.data, partial=True)
        if serializer.is_valid():
            if request.data.get('status') == 'resolved' and not ticket.resolved_at:
                serializer.save(resolved_at=timezone.now())
            else:
                serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            ticket = MaintenanceTicket.objects.get(pk=pk)
        except MaintenanceTicket.DoesNotExist:
            return Response({'detail': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

        ticket.delete()
        return Response({'detail': 'Ticket deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
