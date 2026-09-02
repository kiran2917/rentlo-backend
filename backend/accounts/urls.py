from django.urls import path
from .views import (
    RegisterView, CustomTokenObtainPairView, CustomTokenRefreshView, CurrentUserView, LogoutView, 
    BuyerRequestOTPView, BuyerVerifyOTPView, CompleteRegistrationView, AgentProfileView, UserListView,
    SubAdminListView, SubAdminCreateView, SubAdminUpdatePermissionsView, SubAdminDeleteView,
    AgentKYCView, ChangePasswordView, ForgotPasswordRequestOTPView, ForgotPasswordResetView,
    AdminAgentKYCListView, AdminAgentKYCReviewView, AdminCRMListView, AdminUserToggleStatusView, CheckPhoneView,
    AdminOwnerKYCListView, AdminOwnerKYCReviewView, AdminTestSMSView, AdminSyncOwnerAccountView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('refresh/', CustomTokenRefreshView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', CurrentUserView.as_view(), name='me'),
    path('profile/', CurrentUserView.as_view(), name='profile'),
    path('buyer/profile/', CurrentUserView.as_view(), name='buyer-profile'),
    path('check-phone/', CheckPhoneView.as_view(), name='check-phone'),
    path('buyer-otp/request/', BuyerRequestOTPView.as_view(), name='buyer-otp-request'),
    path('buyer-otp/verify/', BuyerVerifyOTPView.as_view(), name='buyer-otp-verify'),
    path('complete-registration/', CompleteRegistrationView.as_view(), name='complete-registration'),
    path('forgot-password/request-otp/', ForgotPasswordRequestOTPView.as_view(), name='forgot-password-request-otp'),
    path('forgot-password/reset/', ForgotPasswordResetView.as_view(), name='forgot-password-reset'),
    path('agents/<int:id>/', AgentProfileView.as_view(), name='agent-profile'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),

    # Admin CRM & User Management
    path('admin/crm/', AdminCRMListView.as_view(), name='admin-crm-list'),
    path('admin/crm/<int:pk>/toggle-status/', AdminUserToggleStatusView.as_view(), name='admin-crm-toggle-status'),
    path('admin/sync-owner-account/', AdminSyncOwnerAccountView.as_view(), name='admin-sync-owner-account'),

    # Agent KYC & Bank Payout Details
    path('agent/kyc/', AgentKYCView.as_view(), name='agent-kyc'),
    path('admin/agent-kyc/', AdminAgentKYCListView.as_view(), name='admin-agent-kyc-list'),
    path('admin/agent-kyc/<int:pk>/review/', AdminAgentKYCReviewView.as_view(), name='admin-agent-kyc-review'),

    # Owner KYC & Verification Review
    path('admin/owner-kyc/', AdminOwnerKYCListView.as_view(), name='admin-owner-kyc-list'),
    path('admin/owner-kyc/<int:pk>/review/', AdminOwnerKYCReviewView.as_view(), name='admin-owner-kyc-review'),


    # Sub-Admin Management Endpoints
    path('sub-admins/', SubAdminListView.as_view(), name='subadmin-list'),
    path('sub-admins/create/', SubAdminCreateView.as_view(), name='subadmin-create'),
    path('sub-admins/<int:pk>/permissions/', SubAdminUpdatePermissionsView.as_view(), name='subadmin-update-permissions'),
    path('sub-admins/<int:pk>/delete/', SubAdminDeleteView.as_view(), name='subadmin-delete'),

    # Live SMS Gateway Testing
    path('admin/test-sms/', AdminTestSMSView.as_view(), name='admin-test-sms'),
]

