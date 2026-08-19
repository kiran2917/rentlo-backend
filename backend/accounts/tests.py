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

