from django.urls import path
from .views import (
    InitiateUnlockView, PropertyFullDetailsView, MyUnlocksView, SubmitFeedbackView, 
    VerifyUnlockView, AdminUnlockListView, AdminUnlockActionView, AdminFeedbackListView,
    MySubscriptionView, InitiatePassPurchaseView, VerifyPassPurchaseView, ExtendPassValidityView,
    AdminCreateManualTransactionView, InitiateRefundView, GenerateReceiptView,
    OwnerListingPassReceiptView
)

urlpatterns = [
    path('unlocks/admin/list/', AdminUnlockListView.as_view(), name='admin-unlock-list'),
    path('unlocks/admin/<str:id>/action/', AdminUnlockActionView.as_view(), name='admin-unlock-action'),
    path('unlocks/admin/manual-transaction/', AdminCreateManualTransactionView.as_view(), name='admin-manual-transaction'),
    path('unlocks/admin/feedbacks/', AdminFeedbackListView.as_view(), name='admin-feedback-list'),

    path('properties/<int:id>/unlock/initiate/', InitiateUnlockView.as_view(), name='initiate-unlock'),
    path('properties/<int:id>/unlock/verify/', VerifyUnlockView.as_view(), name='verify-unlock'),
    path('properties/<int:id>/full/', PropertyFullDetailsView.as_view(), name='property-full-details'),
    path('my-unlocks/', MyUnlocksView.as_view(), name='my-unlocks'),
    path('unlocks/<int:id>/feedback/', SubmitFeedbackView.as_view(), name='submit-feedback'),
    path('unlocks/<int:id>/refund/', InitiateRefundView.as_view(), name='initiate-refund'),
    
    path('payments/<str:txn_id>/receipt/', GenerateReceiptView.as_view(), name='generate-receipt'),
    path('owner-passes/<int:id>/receipt/', OwnerListingPassReceiptView.as_view(), name='owner-pass-receipt'),

    path('pass/initiate/', InitiatePassPurchaseView.as_view(), name='initiate-pass-purchase'),
    path('pass/verify/', VerifyPassPurchaseView.as_view(), name='verify-pass-purchase'),
    path('pass/extend/', ExtendPassValidityView.as_view(), name='extend-pass-validity'),
    path('my-subscription/', MySubscriptionView.as_view(), name='my-subscription'),
]
