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

        # Reset expires_at to 30 days from now
        prop.expires_at = timezone.now() + timedelta(days=30)
        prop.save()

        # Mark related notifications as read
        from notifications.models import Notification
        notifications = Notification.objects.filter(recipient=request.user, property=prop, is_read=False)
        notifications.update(is_read=True)

        return Response({'detail': 'Property reconfirmed for 30 more days.', 'expires_at': prop.expires_at})
