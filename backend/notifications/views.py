from rest_framework import generics, views, status, permissions
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Notification
from .serializers import NotificationSerializer

class NotificationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')

class NotificationReadView(views.APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(id=pk, recipient=request.user)
            notification.is_read = True
            notification.save()
            return Response({'detail': 'Notification marked as read.'})
        except Notification.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


class VapidPublicKeyView(views.APIView):
    """
    Public endpoint to retrieve the VAPID Public Key for web push registration.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.conf import settings
        pub_key = getattr(settings, 'VAPID_PUBLIC_KEY', '')
        return Response({'public_key': pub_key})


class SubscribeWebPushView(views.APIView):
    """
    Endpoint to register or update a client's Web Push subscription.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        endpoint = request.data.get('endpoint')
        keys = request.data.get('keys', {})
        p256dh = keys.get('p256dh')
        auth = keys.get('auth')

        if not endpoint or not p256dh or not auth:
            return Response(
                {'error': 'endpoint, p256dh, and auth keys are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.user and request.user.is_authenticated:
            from accounts.models import PushSubscription
            subscription, created = PushSubscription.objects.update_or_create(
                endpoint=endpoint,
                defaults={
                    'user': request.user,
                    'p256dh': p256dh,
                    'auth': auth
                }
            )
            return Response(
                {'detail': 'Subscription registered to account successfully.'},
                status=status.HTTP_201_CREATED
            )

        # For guest users, browser subscription is created locally and will link to account on login
        return Response(
            {'detail': 'Browser push enabled. Will sync upon account login.'},
            status=status.HTTP_200_OK
        )


class UnsubscribeWebPushView(views.APIView):
    """
    Endpoint to unregister a client's Web Push subscription upon logout.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        endpoint = request.data.get('endpoint')
        if endpoint:
            from accounts.models import PushSubscription
            deleted_count, _ = PushSubscription.objects.filter(endpoint=endpoint).delete()
            return Response({'detail': f'Removed {deleted_count} push subscriptions.'})
        
        # If user is authenticated and no specific endpoint passed, clean up their subscriptions
        if request.user and request.user.is_authenticated:
            from accounts.models import PushSubscription
            deleted_count, _ = PushSubscription.objects.filter(user=request.user).delete()
            return Response({'detail': f'Removed {deleted_count} push subscriptions for user.'})

        return Response({'detail': 'No endpoint provided.'}, status=status.HTTP_200_OK)
