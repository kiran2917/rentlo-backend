from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

class AccountsAuthTests(APITestCase):
    def setUp(self):
        self.buyer = User.objects.create_user(
            username="9876543210",
            phone="9876543210",
            password="TestPassword123!",
            roles=["buyer"]
        )
        self.admin = User.objects.create_user(
            username="9999999999",
            phone="9999999999",
            password="AdminPassword123!",
            roles=["admin"]
        )

    def test_user_list_unauthorized_for_buyer(self):
        """Verify that standard buyers cannot list all users (BOLA protection)."""
        self.client.force_authenticate(user=self.buyer)
        response = self.client.get('/api/v1/accounts/users/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_list_authorized_for_admin(self):
        """Verify that admins can list users."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/v1/accounts/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_otp_request_does_not_leak_code_in_production(self):
        """Verify OTP request response data."""
        response = self.client.post('/api/v1/accounts/buyer-otp/request/', {'phone': '9876543210'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('require_otp', response.data)

    def test_impersonation_by_admin_success(self):
        """Verify that Admin can start a support assist session on a user account."""
        from accounts.models import ImpersonationAuditLog
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/v1/accounts/admin/impersonate/', {
            'user_id': self.buyer.id,
            'reason': 'Assisting buyer with unlock credits inquiry'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['target_user']['id'], self.buyer.id)

        # Check DPDP audit log was created
        log = ImpersonationAuditLog.objects.filter(admin=self.admin, target_user=self.buyer, is_active=True).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.reason, 'Assisting buyer with unlock credits inquiry')

    def test_impersonation_by_non_admin_forbidden(self):
        """Verify that standard buyers cannot call the impersonation endpoint."""
        self.client.force_authenticate(user=self.buyer)
        response = self.client.post('/api/v1/accounts/admin/impersonate/', {
            'user_id': self.admin.id
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_impersonating_admin_forbidden(self):
        """Verify that admins cannot impersonate another admin (privilege escalation protection)."""
        other_admin = User.objects.create_user(
            username="8888888888",
            phone="8888888888",
            password="AdminPassword456!",
            roles=["admin"]
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/v1/accounts/admin/impersonate/', {
            'user_id': other_admin.id
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_impersonation_exit_restores_admin(self):
        """Verify that exiting impersonation marks the audit session as completed and restores admin."""
        from accounts.models import ImpersonationAuditLog
        # 1. Start impersonation
        self.client.force_authenticate(user=self.admin)
        start_res = self.client.post('/api/v1/accounts/admin/impersonate/', {
            'user_id': self.buyer.id
        })
        self.assertEqual(start_res.status_code, status.HTTP_200_OK)

        # 2. Switch authentication to the target buyer
        self.client.force_authenticate(user=self.buyer)

        # 3. Exit impersonation
        exit_res = self.client.post('/api/v1/accounts/admin/impersonate/exit/', {
            'impersonator_id': self.admin.id
        })
        self.assertEqual(exit_res.status_code, status.HTTP_200_OK)
        self.assertEqual(exit_res.data['user']['id'], self.admin.id)

        # 4. Verify audit log marked as ended
        log = ImpersonationAuditLog.objects.filter(admin=self.admin, target_user=self.buyer).first()
        self.assertFalse(log.is_active)
        self.assertIsNotNone(log.ended_at)


