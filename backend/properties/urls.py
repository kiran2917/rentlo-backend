from django.urls import path
from .views import (
    PropertyListCreateView, RequestOTPView, VerifyOTPView, 
    PublicPropertyListView, PublicPropertyDetailView,
    CityListCreateView, CityDetailView,
    LocalityListCreateView, LocalityDetailView, SuggestLocalitiesView,
    SavedSearchListCreateView, SavedSearchDestroyView,
    MyPropertiesView, OwnerLeadsView,
    InitiateOnboardingPaymentView, VerifyOnboardingPaymentView,
    PlatformSettingsView, SimilarPropertiesView, GenerateDescriptionView,
    PropertyDetailUpdateView, RegistrationConfigView, CreateRegistrationOrderView, OwnerCreditsView,
    InitiateOwnerPassOrderView, VerifyOwnerPassOrderView,
    SettingsVersionView, EstimatePriceView, CalculateListingFeeView,
    PlatformSettingsAuditLogListView, PGOccupancyUpdateView, PropertyMediaDeleteView, PropertyLifecycleView,
    TriggerMigrationView, IPLookupView
)
from .reconfirm_view import PropertyReconfirmView
from .tenant_kyc import TenantKYCListCreateView, TenantKYCDetailView
from .pg_residents import PGResidentListCreateView, PGResidentDetailView
from .maintenance import MaintenanceTicketListCreateView, MaintenanceTicketDetailView

urlpatterns = [
    # Tenant KYC & Background Verification
    path('tenant-kyc/', TenantKYCListCreateView.as_view(), name='tenant-kyc-list-create'),
    path('tenant-kyc/<int:pk>/', TenantKYCDetailView.as_view(), name='tenant-kyc-detail'),

    # PG / Hostel Resident Management
    path('pg-residents/', PGResidentListCreateView.as_view(), name='pg-resident-list-create'),
    path('pg-residents/<int:pk>/', PGResidentDetailView.as_view(), name='pg-resident-detail'),

    # Maintenance & Repair Tickets
    path('maintenance-tickets/', MaintenanceTicketListCreateView.as_view(), name='maintenance-tickets-list-create'),
    path('maintenance-tickets/<int:pk>/', MaintenanceTicketDetailView.as_view(), name='maintenance-tickets-detail'),

    path('ip-lookup/', IPLookupView.as_view(), name='ip-lookup'),
    path('cities/', CityListCreateView.as_view(), name='city-list'),
    path('cities/localities/', LocalityListCreateView.as_view(), name='all-locality-list'),
    path('cities/<int:pk>/', CityDetailView.as_view(), name='city-detail'),
    path('cities/<int:city_id>/localities/', LocalityListCreateView.as_view(), name='locality-list'),
    path('localities/<int:pk>/', LocalityDetailView.as_view(), name='locality-detail'),
    path('suggest-localities/', SuggestLocalitiesView.as_view(), name='suggest-localities'),
    path('cities/<int:city_id>/registration-config/', RegistrationConfigView.as_view(), name='registration-config'),
    path('create-registration-order/', CreateRegistrationOrderView.as_view(), name='create-registration-order'),
    path('trigger-migration/', TriggerMigrationView.as_view(), name='trigger-migration'),
    path('', PropertyListCreateView.as_view(), name='property-list-create'),
    path('<int:pk>/', PropertyDetailUpdateView.as_view(), name='property-detail-update'),
    path('<int:pk>/lifecycle/', PropertyLifecycleView.as_view(), name='property-lifecycle'),
    path('media/<int:pk>/', PropertyMediaDeleteView.as_view(), name='property-media-delete'),
    path('<int:pk>/update-occupancy/', PGOccupancyUpdateView.as_view(), name='update-occupancy'),
    path('<int:pk>/reconfirm/', PropertyReconfirmView.as_view(), name='property-reconfirm'),
    path('public/', PublicPropertyListView.as_view(), name='public-property-list'),
    path('public/<int:pk>/', PublicPropertyDetailView.as_view(), name='public-property-detail'),
    path('public/<int:pk>/similar/', SimilarPropertiesView.as_view(), name='similar-properties'),
    path('otp/request/', RequestOTPView.as_view(), name='otp-request'),
    path('otp/verify/', VerifyOTPView.as_view(), name='otp-verify'),
    path('saved-searches/', SavedSearchListCreateView.as_view(), name='saved-search-list-create'),
    path('saved-searches/<int:pk>/', SavedSearchDestroyView.as_view(), name='saved-search-destroy'),
    path('my-properties/', MyPropertiesView.as_view(), name='my-properties'),
    path('owner-leads/', OwnerLeadsView.as_view(), name='owner-leads'),
    path('owner-credits/', OwnerCreditsView.as_view(), name='owner-credits'),
    path('owner-passes/initiate/', InitiateOwnerPassOrderView.as_view(), name='owner-pass-initiate'),
    path('owner-passes/verify/', VerifyOwnerPassOrderView.as_view(), name='owner-pass-verify'),
    path('<int:pk>/onboarding/initiate/', InitiateOnboardingPaymentView.as_view(), name='onboarding-initiate'),
    path('<int:pk>/onboarding/verify/', VerifyOnboardingPaymentView.as_view(), name='onboarding-verify'),
    path('platform-settings/', PlatformSettingsView.as_view(), name='platform-settings'),
    path('platform-settings/audit-logs/', PlatformSettingsAuditLogListView.as_view(), name='platform-settings-audit-logs'),
    path('platform-settings/version/', SettingsVersionView.as_view(), name='settings-version'),
    path('generate-description/', GenerateDescriptionView.as_view(), name='generate-description'),
    path('estimate-price/', EstimatePriceView.as_view(), name='estimate-price'),
    path('calculate-listing-fee/', CalculateListingFeeView.as_view(), name='calculate-listing-fee'),
]
