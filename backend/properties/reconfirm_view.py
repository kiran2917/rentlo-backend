from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from properties.models import Property
from accounts.permissions import IsAgent

class PropertyReconfirmView(views.APIView):
    permission_classes = [IsAgent]

    def patch(self, request, pk):
        try:
            prop = Property.objects.get(id=pk, agent=request.user)
        except Property.DoesNotExist:
            return Response({'detail': 'Property not found or unauthorized.'}, status=status.HTTP_404_NOT_FOUND)

        if prop.status != 'live':
            return Response({'detail': 'Only live properties can be reconfirmed.'}, status=status.HTTP_400_BAD_REQUEST)

        from properties.models import PlatformSettings
        ps = PlatformSettings.load()

        if prop.property_category == 'pg' or prop.property_type in ['pg', 'pg_hostel', 'pg_single', 'pg_double', 'pg_triple']:
            days = ps.validity_apt_pg_days
        elif prop.property_category == 'commercial':
            days = ps.validity_commercial_days
        else:
            days = ps.validity_residential_days

        prop.expires_at = timezone.now() + timedelta(days=days)
        msg = f'Property reconfirmed for {days} more days.'
        prop.save()

        # Mark related notifications as read
        from notifications.models import Notification
        notifications = Notification.objects.filter(recipient=request.user, property=prop, is_read=False)
        notifications.update(is_read=True)

        return Response({'detail': msg, 'expires_at': prop.expires_at})
