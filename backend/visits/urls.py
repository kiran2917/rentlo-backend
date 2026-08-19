from django.urls import path
from .views import (
    PropertySlotsView, OwnerSlotsView, SlotDeleteView,
    BookSlotView, BookingActionView, BuyerBookingsView
)

urlpatterns = [
    path('my-slots/', OwnerSlotsView.as_view(), name='owner-slots'),
    path('my-bookings/', BuyerBookingsView.as_view(), name='buyer-bookings'),
    path('property/<int:property_id>/slots/', PropertySlotsView.as_view(), name='property-slots'),
    path('slots/<int:slot_id>/book/', BookSlotView.as_view(), name='book-slot'),
    path('slots/<int:slot_id>/delete/', SlotDeleteView.as_view(), name='slot-delete'),
    path('bookings/<int:booking_id>/action/', BookingActionView.as_view(), name='booking-action'),
]
