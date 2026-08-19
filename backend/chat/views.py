from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import ChatMessage
from properties.models import Property
from django.db.models import Q
from django.contrib.auth import get_user_model

User = get_user_model()

class ChatMessagesView(APIView):
    """List messages for a property thread, or send a new message."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = 'chat_send'

    def get(self, request, property_id):
        """Get all messages in the thread for this user and this property."""
        messages = ChatMessage.objects.filter(
            property_id=property_id
        ).filter(
            Q(sender=request.user) | Q(recipient=request.user)
        )
        # Mark messages as read
        messages.filter(recipient=request.user, is_read=False).update(is_read=True)

        data = [{
            'id': m.id,
            'sender_id': m.sender_id,
            'sender_name': m.sender.get_full_name() or m.sender.username,
            'recipient_id': m.recipient_id,
            'message': m.message,
            'is_read': m.is_read,
            'created_at': m.created_at.isoformat(),
        } for m in messages]
        return Response(data)

    def post(self, request, property_id):
        """Send a message to the other party about this property."""
        try:
            prop = Property.objects.get(id=property_id)
        except Property.DoesNotExist:
            return Response({'error': 'Property not found'}, status=404)

        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response({'error': 'Message cannot be empty'}, status=400)

        # Determine recipient
        if request.user == prop.owner:
            # Owner is sending to the buyer they're chatting with
            recipient_id = request.data.get('recipient_id')
            if not recipient_id:
                return Response({'error': 'recipient_id required for owner'}, status=400)
            try:
                recipient = User.objects.get(id=recipient_id)
            except User.DoesNotExist:
                return Response({'error': 'Recipient not found'}, status=404)
        else:
            # Buyer is sending to owner
            recipient = prop.owner

        msg = ChatMessage.objects.create(
            property=prop,
            sender=request.user,
            recipient=recipient,
            message=message_text
        )

        # Notify recipient
        try:
            from notifications.models import Notification
            sender_name = request.user.first_name or request.user.username or "Someone"
            prop_title = prop.property_type.replace('_', ' ').capitalize()
            snippet = message_text[:40] + ("..." if len(message_text) > 40 else "")
            
            Notification.objects.create(
                recipient=recipient,
                message=f"💬 New Message from {sender_name} regarding {prop_title}: \"{snippet}\"",
                property=prop
            )
        except Exception as e:
            print("Failed to send chat notification:", e)

        return Response({
            'id': msg.id,
            'sender_id': msg.sender_id,
            'sender_name': msg.sender.get_full_name() or msg.sender.username,
            'recipient_id': msg.recipient_id,
            'message': msg.message,
            'is_read': msg.is_read,
            'created_at': msg.created_at.isoformat(),
        }, status=201)


class ChatThreadsView(APIView):
    """For owners: list all unique buyer threads across all their properties."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get all messages where user is sender or recipient
        messages = ChatMessage.objects.filter(
            Q(sender=request.user) | Q(recipient=request.user)
        ).select_related('sender', 'recipient', 'property').order_by('-created_at')

        # Batch fetch unread counts grouped by property and sender to eliminate N+1 DB queries
        from django.db.models import Count
        unread_counts_qs = (
            ChatMessage.objects.filter(recipient=request.user, is_read=False)
            .values('property_id', 'sender_id')
            .annotate(cnt=Count('id'))
        )
        unread_map = { (item['property_id'], item['sender_id']): item['cnt'] for item in unread_counts_qs }

        seen = set()
        threads = []
        for m in messages:
            # The other party
            other = m.recipient if m.sender == request.user else m.sender
            key = (m.property_id, other.id)
            if key not in seen:
                seen.add(key)
                unread = unread_map.get((m.property_id, other.id), 0)
                threads.append({
                    'property_id': m.property_id,
                    'property_title': m.property.property_type,
                    'property_locality': m.property.locality.name if m.property.locality else '',
                    'other_user_id': other.id,
                    'other_user_name': other.get_full_name() or other.username,
                    'last_message': m.message,
                    'last_message_time': m.created_at.isoformat(),
                    'unread_count': unread,
                })
        return Response(threads)


class UnreadCountView(APIView):
    """Quick endpoint to get total unread message count for badge."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = ChatMessage.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread': count})

