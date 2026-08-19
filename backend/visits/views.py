from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from .models import VisitSlot, VisitBooking
from properties.models import Property


class PropertySlotsView(APIView):
    """Owner: manage slots. Buyer: list available slots for a property."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, property_id):
        """List all active slots for a property (buyer view)."""
        slots = VisitSlot.objects.filter(
            property_id=property_id, is_active=True
        ).prefetch_related('bookings')
        data = []
        for s in slots:
            buyer_booking = s.bookings.filter(buyer=request.user).first()
            data.append({
                'id': s.id,
                'slot_date': str(s.slot_date),
                'slot_time': str(s.slot_time),
                'max_bookings': s.max_bookings,
                'booking_count': s.booking_count(),
                'is_full': s.is_full(),
                'my_booking': {
                    'id': buyer_booking.id,
                    'status': buyer_booking.status,
                } if buyer_booking else None,
            })
        return Response(data)

    def post(self, request, property_id):
        """Owner: create a new visit slot."""
        try:
            prop = Property.objects.get(id=property_id, owner=request.user)
        except Property.DoesNotExist:
            return Response({'error': 'Property not found or not yours'}, status=403)

        slot = VisitSlot.objects.create(
            property=prop,
            owner=request.user,
            slot_date=request.data.get('slot_date'),
            slot_time=request.data.get('slot_time'),
            max_bookings=request.data.get('max_bookings', 1),
        )
        return Response({'id': slot.id, 'slot_date': str(slot.slot_date), 'slot_time': str(slot.slot_time)}, status=201)


class OwnerSlotsView(APIView):
    """Owner: list ALL their slots with bookings across all their properties."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        slots = VisitSlot.objects.filter(owner=request.user).prefetch_related('bookings__buyer', 'property')
        data = []
        for s in slots:
            bookings_data = []
            for b in s.bookings.all():
                bookings_data.append({
                    'id': b.id,
                    'buyer_name': b.buyer.get_full_name() or b.buyer.username,
                    'buyer_phone': b.buyer.phone or '',
                    'status': b.status,
                    'note': b.note,
                })
            data.append({
                'id': s.id,
                'property_id': s.property_id,
                'property_type': s.property.property_type,
                'slot_date': str(s.slot_date),
                'slot_time': str(s.slot_time),
                'max_bookings': s.max_bookings,
                'is_active': s.is_active,
                'bookings': bookings_data,
            })
        return Response(data)


class SlotDeleteView(APIView):
    """Owner: deactivate/delete a slot."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, slot_id):
        try:
            slot = VisitSlot.objects.get(id=slot_id, owner=request.user)
        except VisitSlot.DoesNotExist:
            return Response({'error': 'Slot not found'}, status=404)
        slot.is_active = False
        slot.save()
        return Response({'detail': 'Slot removed.'})


from notifications.models import Notification


import logging
logger = logging.getLogger(__name__)

class BookSlotView(APIView):
    """Buyer: book a slot."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slot_id):
        from django.db import transaction
        with transaction.atomic():
            try:
                slot = VisitSlot.objects.select_for_update().get(id=slot_id, is_active=True)
            except VisitSlot.DoesNotExist:
                return Response({'error': 'Slot not found'}, status=404)

            if slot.is_full():
                return Response({'error': 'This slot is fully booked'}, status=400)

            booking, created = VisitBooking.objects.get_or_create(
                slot=slot,
                buyer=request.user,
                defaults={'note': request.data.get('note', '')}
            )
            if not created:
                return Response({'error': 'You already booked this slot'}, status=400)

        # Notify Owner
        try:
            buyer_name = request.user.first_name or request.user.username or "A buyer"
            prop_title = slot.property.property_type.replace('_', ' ').capitalize()
            date_str = slot.slot_date.strftime("%d %b %Y")
            time_str = slot.slot_time.strftime("%I:%M %p")
            Notification.objects.create(
                recipient=slot.owner,
                message=f"🗓️ New Visit Booking: {buyer_name} requested a viewing for {prop_title} on {date_str} at {time_str}.",
                property=slot.property
            )
        except Exception as e:
            logger.error(f"Failed to send notification to owner: {e}", exc_info=True)

        return Response({'id': booking.id, 'status': booking.status}, status=201)


class BookingActionView(APIView):
    """Owner: approve or reject a booking."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, booking_id):
        try:
            booking = VisitBooking.objects.get(id=booking_id, slot__owner=request.user)
        except VisitBooking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=404)

        new_status = request.data.get('status')
        if new_status not in ['approved', 'rejected']:
            return Response({'error': 'Invalid status'}, status=400)

        booking.status = new_status
        booking.save()

        # Notify Buyer
        try:
            prop_title = booking.slot.property.property_type.replace('_', ' ').capitalize()
            date_str = booking.slot.slot_date.strftime("%d %b %Y")
            time_str = booking.slot.slot_time.strftime("%I:%M %p")
            
            if new_status == 'approved':
                msg = f"🎉 Visit Approved! Owner approved your viewing for {prop_title} on {date_str} at {time_str}."
            else:
                msg = f"❌ Visit Update: Your viewing request for {prop_title} on {date_str} was declined by the owner."
                
            Notification.objects.create(
                recipient=booking.buyer,
                message=msg,
                property=booking.slot.property
            )
        except Exception as e:
            logger.error(f"Failed to send notification to buyer: {e}", exc_info=True)

        return Response({'id': booking.id, 'status': booking.status})


class BuyerBookingsView(APIView):
    """Buyer: list all their visit bookings."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bookings = VisitBooking.objects.filter(buyer=request.user).select_related(
            'slot', 'slot__property', 'slot__property__locality'
        )
        data = []
        for b in bookings:
            data.append({
                'id': b.id,
                'status': b.status,
                'slot_date': str(b.slot.slot_date),
                'slot_time': str(b.slot.slot_time),
                'property_id': b.slot.property_id,
                'property_type': b.slot.property.property_type,
                'property_locality': b.slot.property.locality.name if b.slot.property.locality else '',
            })
        return Response(data)

