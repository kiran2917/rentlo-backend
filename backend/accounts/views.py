from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.conf import settings
from .models import User
from .serializers import UserSerializer, RegisterSerializer
import logging
import re

security_logger = logging.getLogger('security')
audit_logger = logging.getLogger('audit')

def validate_indian_phone(phone):
    clean = re.sub(r'\D', '', str(phone or ''))
    if len(clean) != 10:
        return False, "Please enter a valid 10-digit mobile number."
    if clean[0] not in ['6', '7', '8', '9']:
        return False, "Mobile number must start with 6, 7, 8, or 9."
    
    dummy_patterns = ["1234567890", "1231231231", "0000000000", "1111111111", "9999999999", "8888888888", "7777777777"]
    if clean in dummy_patterns or len(set(clean)) == 1:
        return False, "Please enter a valid 10-digit personal mobile number."
    
    return True, clean

def mask_phone_pii(phone):
    clean = re.sub(r'\D', '', str(phone or ''))
    if len(clean) >= 10:
        return f"+91 {clean[:2]}XXXXXX{clean[-2:]}"
    return "<REDACTED_PHONE>"

from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username_or_phone = attrs.get('username')
        password = attrs.get('password')

        # Clean digits for phone lookup (e.g. "+91 9902591115" -> "9902591115")
        clean_phone = re.sub(r'\D', '', str(username_or_phone or ''))

        user = None
        if clean_phone and len(clean_phone) >= 10:
            target_10 = clean_phone[-10:]
            user = User.objects.filter(
                Q(phone__endswith=target_10) | Q(username=username_or_phone)
            ).first()

        if not user:
            user = User.objects.filter(username=username_or_phone).first()

        if user:
            if not user.check_password(password):
                raise AuthenticationFailed(
                    'Incorrect password. Please check your password or click Forgot Password.'
                )
            if not user.is_active:
                raise AuthenticationFailed(
                    'This account has been deactivated. Please contact support.'
                )
            attrs['username'] = user.username
        else:
            raise AuthenticationFailed(
                'No registered account found with this mobile number. Please Sign Up.'
            )

        data = super().validate(attrs)
        data['role'] = self.user.role
        data['roles'] = self.user.roles
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'first_name': self.user.first_name,
            'email': self.user.email,
            'phone': self.user.phone,
            'role': self.user.role,
            'roles': self.user.roles,
            'force_password_change': self.user.force_password_change
        }
        return data

from django.utils import timezone

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = 'login'
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access')
            refresh_token = response.data.get('refresh')
            
            response.set_cookie(
                'access_token',
                access_token,
                max_age=3600 * 24, # 1 day
                httponly=True,
                samesite='None' if not settings.DEBUG else 'Lax',
                secure=not settings.DEBUG,
            )
            response.set_cookie(
                'refresh_token',
                refresh_token,
                max_age=3600 * 24 * 7, # 7 days
                httponly=True,
                samesite='None' if not settings.DEBUG else 'Lax',
                secure=not settings.DEBUG,
            )
            # Remove tokens from response body for extra security, 
            # but keep user data so frontend knows the role.
            if 'access' in response.data:
                del response.data['access']
            if 'refresh' in response.data:
                del response.data['refresh']
        return response

from django.db import transaction

class DataErasureRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user_id = user.id
        
        try:
            with transaction.atomic():
                # 1. Anonymize PII fields on User model
                user.first_name = "Erased"
                user.last_name = "User"
                user.email = f"erased_{user_id}@erased.local"
                if user.phone:
                    user.phone = f"erased_{user_id}"
                user.username = f"erased_user_{user_id}"
                user.is_active = False
                user.dpdp_consent_given = False
                user.dpdp_consent_timestamp = timezone.now()
                user.save()

                # 2. Scrub outgoing chat message contents sent by user
                from chat.models import ChatMessage
                ChatMessage.objects.filter(sender=user).update(message="[Content Erased Per User Request]")

            # Internal Note: Financial record retention rationale pending formal legal counsel confirmation
            security_logger.info(f"DPDP Data Erasure & PII Anonymization executed for user ID {user_id} (Financial audit retention: pending formal legal review)")
            return Response({
                'detail': 'Account deactivated and personal identity data (PII) irreversibly anonymized. Statutory financial transaction records are retained as required by applicable tax and banking laws.'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            security_logger.error(f"DPDP Data Erasure failed for user ID {user_id}: {str(e)}", exc_info=True)
            return Response({
                'detail': 'Data erasure operation failed to complete cleanly. Please try again or contact support.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CustomTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            request.data['refresh'] = refresh_token
            
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access')
            response.set_cookie(
                'access_token',
                access_token,
                max_age=3600 * 24,
                httponly=True,
                samesite='None' if not settings.DEBUG else 'Lax',
                secure=not settings.DEBUG,
            )
            # If SimpleJWT rotated the refresh token, store the new one in the cookie
            refresh_token_rotated = response.data.get('refresh')
            if refresh_token_rotated:
                response.set_cookie(
                    'refresh_token',
                    refresh_token_rotated,
                    max_age=3600 * 24 * 7, # 7 days
                    httponly=True,
                    samesite='None' if not settings.DEBUG else 'Lax',
                    secure=not settings.DEBUG,
                )
            if 'access' in response.data:
                del response.data['access']
            if 'refresh' in response.data:
                del response.data['refresh']
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh')
        if refresh_token:
            try:
                from rest_framework_simplejwt.tokens import RefreshToken
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        response = Response({'detail': 'Successfully logged out.'})
        # Delete access and refresh tokens with correct SameSite/Secure parameters matching set_cookie
        response.delete_cookie(
            'access_token',
            samesite='None' if not settings.DEBUG else 'Lax',
            secure=not settings.DEBUG,
        )
        response.delete_cookie(
            'refresh_token',
            samesite='None' if not settings.DEBUG else 'Lax',
            secure=not settings.DEBUG,
        )
        response.delete_cookie(
            'token',
            samesite='None' if not settings.DEBUG else 'Lax',
            secure=not settings.DEBUG,
        )
        return response


class CheckPhoneView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        phone = request.query_params.get('phone', '').strip()
        if not phone:
            return Response({'exists': False})

        user = User.objects.filter(phone=phone).first()
        if user:
            return Response({
                'exists': True,
                'roles': user.roles if isinstance(user.roles, list) else [str(user.roles)],
                'first_name': user.first_name,
                'username': user.username
            })
        else:
            return Response({'exists': False})


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

class CurrentUserView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

import random
from django.utils import timezone
from datetime import timedelta
from properties.models import ConsentOTP
import secrets
from rest_framework_simplejwt.tokens import RefreshToken


def send_otp_sms(phone: str, code: str, ps) -> bool:
    """
    Sends OTP via the configured SMS provider in PlatformSettings.
    Returns True if sent successfully, False if in demo/unconfigured mode.
    `phone` should already be a clean 10-digit Indian number (no +91 prefix needed internally).
    """
    provider = getattr(ps, 'sms_provider', 'none')
    if provider == 'none' or not provider:
        return False

    api_key = getattr(ps, 'sms_api_key', '')
    api_secret = getattr(ps, 'sms_api_secret', '')
    sender_id = getattr(ps, 'sms_sender_id', 'RENTLO') or 'RENTLO'
    template_id = getattr(ps, 'sms_template_id', '')
    from_number = getattr(ps, 'sms_from_number', '')
    message = f"{code} is your Rentlo OTP. Valid for 10 minutes. Do not share with anyone."

    try:
        import requests as req_lib

        if provider == 'fast2sms':
            # Fast2SMS Quick SMS API
            headers = {"authorization": api_key, "Content-Type": "application/json"}
            payload = {
                "route": "otp",
                "variables_values": code,
                "numbers": phone,
            }
            if template_id:
                payload["flash"] = "0"
            resp = req_lib.post("https://www.fast2sms.com/dev/bulkV2", json=payload, headers=headers, timeout=10)
            return resp.status_code == 200 and resp.json().get('return') is True

        elif provider == 'msg91':
            # MSG91 OTP API
            url = "https://api.msg91.com/api/v5/otp"
            params = {
                "authkey": api_key,
                "mobile": f"91{phone}",
                "message": message,
                "sender": sender_id,
                "otp": code,
            }
            if template_id:
                params["template_id"] = template_id
            resp = req_lib.post(url, params=params, timeout=10)
            return resp.status_code == 200

        elif provider == 'twilio':
            # Twilio SMS API
            from urllib.parse import urlencode
            account_sid = api_key
            auth_token = api_secret
            to_number = f"+91{phone}"
            url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
            data = urlencode({"From": from_number, "To": to_number, "Body": message})
            resp = req_lib.post(url, data=data, auth=(account_sid, auth_token), timeout=10)
            return resp.status_code in (200, 201)

        elif provider == 'exotel':
            # Exotel SMS API
            account_sid = api_key
            auth_token = api_secret
            url = f"https://api.exotel.com/v1/Accounts/{account_sid}/Sms/send"
            data = {"From": sender_id, "To": f"0{phone}", "Body": message}
            resp = req_lib.post(url, data=data, auth=(account_sid, auth_token), timeout=10)
            return resp.status_code in (200, 201)

        elif provider == 'textlocal':
            # TextLocal SMS API
            url = "https://api.textlocal.in/send/"
            data = {
                "apikey": api_key,
                "numbers": f"91{phone}",
                "message": message,
                "sender": sender_id,
            }
            resp = req_lib.post(url, data=data, timeout=10)
            result = resp.json()
            return result.get('status') == 'success'

    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"SMS sending failed via {provider}: {e}")

    return False


class BuyerRequestOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'otp_request'

    def post(self, request):
        from properties.models import PlatformSettings, OTPVerification
        phone = request.data.get('phone')
        intended_role = request.data.get('intended_role', 'buyer')
        action = request.data.get('action')
        
        is_valid, phone_or_err = validate_indian_phone(phone)
        if not is_valid:
            return Response({'detail': phone_or_err}, status=status.HTTP_400_BAD_REQUEST)
        phone = phone_or_err

        # Check if signing up but user already exists
        if action == 'signup' and User.objects.filter(phone=phone).exists():
            return Response({'detail': 'This mobile number is already registered. Please Sign In instead.'}, status=status.HTTP_400_BAD_REQUEST)

        # Determine if it's a login or signup
        is_signup = not User.objects.filter(phone=phone).exists()

        ps = PlatformSettings.load()
        if not ps.requires_otp(intended_role, is_signup):
            return Response({
                'detail': 'Phone number accepted (OTP bypassed)', 
                'demo_code': '000000',
                'require_otp': False
            })

        # Generate real OTP if SMS is configured, otherwise use demo code
        sms_live = (getattr(ps, 'sms_provider', 'none') != 'none')
        code = str(secrets.randbelow(900000) + 100000) if sms_live else '000000'

        # Save OTP for verification
        obj, created = OTPVerification.objects.get_or_create(phone=phone, defaults={'code': code, 'expires_at': timezone.now() + timedelta(minutes=10)})
        if not created:
            obj.code = code
            obj.expires_at = timezone.now() + timedelta(minutes=10)
            obj.save()

        # Attempt to send SMS
        sms_sent = send_otp_sms(phone, code, ps) if sms_live else False

        resp_data = {
            'detail': 'OTP sent to your mobile number.' if sms_sent else 'OTP sent successfully. Use code 000000 to verify.',
            'require_otp': True,
        }
        # Only return demo_code when in demo mode (no real SMS configured)
        if not sms_live:
            resp_data['demo_code'] = '000000'

        return Response(resp_data)


import uuid

class BuyerVerifyOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'otp_verify'

    def post(self, request):
        from properties.models import PlatformSettings, OTPVerification
        phone = request.data.get('phone')
        code = request.data.get('code')
        intended_role = request.data.get('intended_role', 'buyer')

        if not phone:
            return Response({'detail': 'Phone number is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        is_signup = not User.objects.filter(phone=phone).exists()
        platform_settings = PlatformSettings.load()
        
        if platform_settings.requires_otp(intended_role, is_signup) and not getattr(platform_settings, 'otp_bypass_enabled', False):
            from django.core.cache import cache
            from datetime import timedelta

            lockout_key = f"otp_lockout:{phone}"
            attempts_key = f"otp_attempts:{phone}"

            # Check if currently locked out
            lockout_expiry = cache.get(lockout_key)
            if lockout_expiry:
                remaining = int((lockout_expiry - timezone.now()).total_seconds())
                if remaining > 0:
                    return Response({'detail': f'Too many failed attempts. Locked out. Please retry in {remaining} seconds.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

            if not code:
                return Response({'detail': 'OTP code is required.'}, status=status.HTTP_400_BAD_REQUEST)

            otp_record = OTPVerification.objects.filter(phone=phone).first()
            if not otp_record:
                return Response({'detail': 'Please request an OTP first.'}, status=status.HTTP_400_BAD_REQUEST)

            if otp_record.code != code:
                attempts = cache.get(attempts_key, 0) + 1
                if attempts >= 5:
                    # Lock out for 15 minutes (900 seconds)
                    cache.set(lockout_key, timezone.now() + timedelta(minutes=15), timeout=900)
                    cache.delete(attempts_key)
                    return Response({'detail': 'Too many failed attempts. You have been locked out for 15 minutes.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
                else:
                    cache.set(attempts_key, attempts, timeout=900)
                    remaining_attempts = 5 - attempts
                    return Response({'detail': f'Invalid OTP code. {remaining_attempts} attempts remaining.'}, status=status.HTTP_400_BAD_REQUEST)

            if otp_record.expires_at < timezone.now():
                return Response({'detail': 'OTP code has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

            otp_record.delete()
            cache.delete(attempts_key)

        # directly find or create user with phone number
        user = User.objects.filter(phone=phone).first()
        
        if user and not user.is_active:
            return Response({'detail': 'Your account has been permanently banned.', 'is_banned': True}, status=status.HTTP_403_FORBIDDEN)
            
        if not user:
            from django.core.signing import TimestampSigner
            signer = TimestampSigner()
            registration_token = signer.sign_object({'phone': phone, 'intended_role': intended_role})
            return Response({
                'detail': 'OTP verified, please complete registration',
                'is_new_user': True,
                'registration_token': registration_token
            })
        else:
            user.is_phone_verified = True
            user.dpdp_consent_given = True
            user.dpdp_consent_timestamp = timezone.now()
            user.dpdp_consent_version = getattr(settings, 'CURRENT_DPDP_POLICY_VERSION', '1.0')  # Server-authoritative
            if intended_role not in user.roles:
                user.roles.append(intended_role)
            user.save(update_fields=['is_phone_verified', 'dpdp_consent_given', 'dpdp_consent_timestamp', 'dpdp_consent_version', 'roles'])

        # Generate tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        security_logger.info(f"Successful OTP verification for phone: {mask_phone_pii(phone)} (User: {user.username}, Role: {intended_role})")

        response = Response({
            'detail': 'Verified successfully',
            'role': user.roles[0] if user.roles else 'buyer',
            'roles': user.roles,
            'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'phone': user.phone,
                'role': user.roles[0] if user.roles else 'buyer',
                'roles': user.roles,
                'force_password_change': user.force_password_change
            }
        })

        # Set cookies — secure=True in production, False only in local dev
        response.set_cookie(
            'access_token',
            access_token,
            max_age=3600 * 24,
            httponly=True,
            samesite='None' if not settings.DEBUG else 'Lax',
            secure=not settings.DEBUG,
        )
        response.set_cookie(
            'refresh_token',
            refresh_token,
            max_age=3600 * 24 * 7,
            httponly=True,
            samesite='None' if not settings.DEBUG else 'Lax',
            secure=not settings.DEBUG,
        )
        return response

class CompleteRegistrationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        import uuid
        from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
        
        token = request.data.get('registration_token')
        first_name = request.data.get('first_name')
        password = request.data.get('password')
        phone = request.data.get('phone')
        role = request.data.get('role', 'owner')
        
        if not first_name or not password:
            return Response({'detail': 'Full Name and Password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        target_phone = phone
        intended_role = role

        if token:
            signer = TimestampSigner()
            try:
                data = signer.unsign_object(token, max_age=86400)
                target_phone = data.get('phone', target_phone)
                intended_role = data.get('intended_role', intended_role)
            except Exception:
                pass

        if not target_phone:
            return Response({'detail': 'Phone number or registration session is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(phone=target_phone).first()
        if user:
            user.first_name = first_name
            user.set_password(password)
            current_roles = list(user.roles) if isinstance(user.roles, list) else []
            if intended_role not in current_roles:
                current_roles.append(intended_role)
            user.roles = current_roles
            user.is_phone_verified = True
            user.dpdp_consent_given = True
            user.dpdp_consent_timestamp = timezone.now()
            user.save()
        else:
            username = f"{intended_role}_{uuid.uuid4().hex[:8]}"
            user = User.objects.create_user(
                username=username,
                password=password,
                phone=target_phone,
                first_name=first_name,
                roles=[intended_role],
                is_phone_verified=True,
                dpdp_consent_given=True,
                dpdp_consent_timestamp=timezone.now()
            )

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            'detail': 'Registration completed successfully.',
            'role': user.roles[0] if user.roles else intended_role,
            'roles': user.roles,
            'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'phone': user.phone,
                'role': user.roles[0] if user.roles else intended_role,
                'roles': user.roles,
                'force_password_change': user.force_password_change
            }
        })
        response.set_cookie('access_token', access_token, max_age=3600 * 24, httponly=True, samesite='None' if not settings.DEBUG else 'Lax', secure=not settings.DEBUG)
        response.set_cookie('refresh_token', refresh_token, max_age=3600 * 24 * 7, httponly=True, samesite='None' if not settings.DEBUG else 'Lax', secure=not settings.DEBUG)
        return response

from .serializers import AgentSerializer

class AgentProfileView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = AgentSerializer
    queryset = User.objects.filter(roles__contains='agent')
    lookup_field = 'id'

from accounts.permissions import IsAdmin

class UserListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = UserSerializer
    queryset = User.objects.all()



class SubAdminListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        all_users = User.objects.all().order_by('-date_joined')
        sub_admins = []
        for u in all_users:
            if u.id == request.user.id:
                continue
            u_roles = u.roles if isinstance(u.roles, list) else [str(u.roles)]
            has_sub_admin_role = any(r in ['sub_admin', 'subadmin'] for r in u_roles)
            has_perms = bool(u.sub_admin_permissions)
            if has_sub_admin_role or has_perms:
                sub_admins.append(u)

        data = [{
            'id': u.id,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'phone': u.phone,
            'email': u.email,
            'roles': u.roles,
            'sub_admin_permissions': u.sub_admin_permissions or {},
            'date_joined': u.date_joined
        } for u in sub_admins]
        return Response(data)

class SubAdminCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        phone = request.data.get('phone')
        permissions_dict = request.data.get('sub_admin_permissions', {})

        if not username or not password:
            return Response({'detail': 'Username and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already taken.'}, status=status.HTTP_400_BAD_REQUEST)

        if phone and User.objects.filter(phone=phone).exists():
            return Response({'detail': 'Phone number already registered.'}, status=status.HTTP_400_BAD_REQUEST)

        account_role = request.data.get('role', 'sub_admin')
        roles_list = ['agent'] if account_role == 'agent' else ['admin', 'sub_admin']

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            roles=roles_list,
            force_password_change=True,
            sub_admin_permissions=permissions_dict if account_role != 'agent' else {}
        )

        return Response({
            'detail': 'Sub-Admin account created successfully.',
            'id': user.id,
            'username': user.username,
            'sub_admin_permissions': user.sub_admin_permissions
        })

class SubAdminUpdatePermissionsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def put(self, request, pk):
        try:
            sub_admin = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Sub-Admin account not found.'}, status=status.HTTP_404_NOT_FOUND)

        permissions_dict = request.data.get('sub_admin_permissions')
        if permissions_dict is not None:
            sub_admin.sub_admin_permissions = permissions_dict
            sub_admin.save(update_fields=['sub_admin_permissions'])

        return Response({
            'detail': 'Sub-Admin authorities updated successfully.',
            'id': sub_admin.id,
            'sub_admin_permissions': sub_admin.sub_admin_permissions
        })

class SubAdminDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, pk):
        try:
            sub_admin = User.objects.get(pk=pk)
            sub_admin.delete()
            return Response({'detail': 'Sub-Admin account deleted.'})
        except User.DoesNotExist:
            return Response({'detail': 'Sub-Admin account not found.'}, status=status.HTTP_404_NOT_FOUND)


# =========================================================
# AGENT FIRST-TIME ONBOARDING, KYC & BANK DETAILS VIEWS
# =========================================================
from .models import AgentKYC
from .serializers import AgentKYCSerializer
from django.utils import timezone

class AgentKYCView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        kyc, _ = AgentKYC.objects.get_or_create(user=request.user)
        return Response(AgentKYCSerializer(kyc).data)

    def post(self, request):
        kyc, _ = AgentKYC.objects.get_or_create(user=request.user)
        
        # Prevent editing if already verified
        if kyc.status == 'verified':
            return Response({'detail': 'KYC is already verified and locked.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AgentKYCSerializer(kyc, data=request.data, partial=True)
        if serializer.is_valid():
            kyc_obj = serializer.save()
            kyc_obj.status = 'submitted'
            kyc_obj.submitted_at = timezone.now()
            kyc_obj.rejection_reason = None
            kyc_obj.save()
            return Response(AgentKYCSerializer(kyc_obj).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        new_password = request.data.get('new_password')
        if not new_password or len(new_password) < 6:
            return Response({'detail': 'Password must be at least 6 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.force_password_change = False
        request.user.save()
        return Response({'detail': 'Password updated successfully. You can now use your new password.'})


class ForgotPasswordRequestOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'otp_request'

    def post(self, request):
        phone_or_user = request.data.get('phone', '').strip() or request.data.get('username', '').strip()
        if not phone_or_user:
            return Response({'detail': 'Mobile number or username is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(phone=phone_or_user).first() or User.objects.filter(username=phone_or_user).first()
        if not user:
            return Response({'detail': 'No registered account found with this username or mobile number.'}, status=status.HTTP_404_NOT_FOUND)

        target_phone = user.phone or phone_or_user
        # Generate real OTP if SMS is configured, otherwise use demo code
        from properties.models import OTPVerification
        ps = PlatformSettings.load() if 'PlatformSettings' in dir() else None
        if ps is None:
            from properties.models import PlatformSettings
            ps = PlatformSettings.load()
        sms_live = (getattr(ps, 'sms_provider', 'none') != 'none')
        code = str(secrets.randbelow(900000) + 100000) if sms_live else '000000'

        obj, created = OTPVerification.objects.get_or_create(
            phone=target_phone,
            defaults={'code': code, 'expires_at': timezone.now() + timedelta(minutes=10)}
        )
        if not created:
            obj.code = code
            obj.expires_at = timezone.now() + timedelta(minutes=10)
            obj.save()

        # Attempt to send SMS
        sms_sent = send_otp_sms(target_phone, code, ps) if sms_live else False

        security_logger.info(f"Password reset OTP generated for user: {user.username}")
        resp = {
            'detail': f'OTP sent to your mobile number for @{user.username}.' if sms_sent else f'Password reset OTP sent for @{user.username}. Use code 000000 to verify.',
            'phone': target_phone,
        }
        if not sms_live:
            resp['demo_code'] = '000000'
        return Response(resp, status=status.HTTP_200_OK)


class ForgotPasswordResetView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'otp_verify'

    def post(self, request):
        phone_or_user = request.data.get('phone', '').strip() or request.data.get('username', '').strip()
        code = request.data.get('code', '').strip()
        new_password = request.data.get('new_password', '').strip()

        if not all([phone_or_user, code, new_password]):
            return Response({'detail': 'Username/Phone, OTP code, and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({'detail': 'Password must be at least 6 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(phone=phone_or_user).first() or User.objects.filter(username=phone_or_user).first()
        if not user:
            return Response({'detail': 'No registered account found with this username or mobile number.'}, status=status.HTTP_404_NOT_FOUND)

        target_phone = user.phone or phone_or_user
        from properties.models import PlatformSettings, OTPVerification
        platform_settings = PlatformSettings.load()
        is_bypass = platform_settings.otp_bypass_enabled

        if not is_bypass:
            from django.core.cache import cache
            from datetime import timedelta

            lockout_key = f"otp_lockout:{target_phone}"
            attempts_key = f"otp_attempts:{target_phone}"

            # Check if currently locked out
            lockout_expiry = cache.get(lockout_key)
            if lockout_expiry:
                remaining = int((lockout_expiry - timezone.now()).total_seconds())
                if remaining > 0:
                    return Response({'detail': f'Too many failed attempts. Locked out. Please retry in {remaining} seconds.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

            otp_record = OTPVerification.objects.filter(phone=target_phone).first()
            if not otp_record:
                return Response({'detail': 'Please request a password reset OTP first.'}, status=status.HTTP_400_BAD_REQUEST)

            if otp_record.code != code:
                attempts = cache.get(attempts_key, 0) + 1
                if attempts >= 5:
                    # Lock out for 15 minutes (900 seconds)
                    cache.set(lockout_key, timezone.now() + timedelta(minutes=15), timeout=900)
                    cache.delete(attempts_key)
                    return Response({'detail': 'Too many failed attempts. You have been locked out for 15 minutes.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
                else:
                    cache.set(attempts_key, attempts, timeout=900)
                    remaining_attempts = 5 - attempts
                    return Response({'detail': f'Invalid OTP code. {remaining_attempts} attempts remaining.'}, status=status.HTTP_400_BAD_REQUEST)

            if otp_record.expires_at < timezone.now():
                return Response({'detail': 'OTP code has expired.'}, status=status.HTTP_400_BAD_REQUEST)

            otp_record.delete()
            cache.delete(attempts_key)

        user.set_password(new_password)
        user.force_password_change = False
        user.save()
        return Response({'detail': f'Password for @{user.username} updated successfully! You can now sign in.'})


class AdminAgentKYCListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AgentKYCSerializer
    queryset = AgentKYC.objects.all().order_by('-updated_at')


class AdminAgentKYCReviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            kyc = AgentKYC.objects.get(pk=pk)
        except AgentKYC.DoesNotExist:
            return Response({'detail': 'KYC record not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action') # 'approve' or 'reject'
        reason = request.data.get('reason', '')

        if action == 'approve':
            kyc.status = 'verified'
            kyc.verified_at = timezone.now()
            kyc.verified_by = request.user
            kyc.rejection_reason = None
            kyc.save()
            audit_logger.info(f"Agent KYC APPROVED for user {kyc.user.username} (ID: {kyc.user.id}) by admin {request.user.username}")
            return Response({'detail': f'Agent {kyc.user.username} KYC approved and verified successfully.'})
        elif action == 'reject':
            kyc.status = 'rejected'
            kyc.rejection_reason = reason or 'Uploaded documents or bank details did not pass verification.'
            kyc.save()
            audit_logger.info(f"Agent KYC REJECTED for user {kyc.user.username} (ID: {kyc.user.id}) by admin {request.user.username}. Reason: {kyc.rejection_reason}")
            return Response({'detail': f'Agent {kyc.user.username} KYC rejected with reason.'})
        else:
            return Response({'detail': 'Invalid action. Choose approve or reject.'}, status=status.HTTP_400_BAD_REQUEST)


class AdminCRMListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        from unlocks.models import Unlock, BuyerSubscription
        from properties.models import Property
        from django.db.models import Q, Sum

        search = request.query_params.get('search', '').strip()
        role = request.query_params.get('role', '').strip()
        account_status = request.query_params.get('account_status', '').strip()
        pass_filter = request.query_params.get('pass_filter', '').strip()
        listing_filter = request.query_params.get('listing_filter', '').strip()
        sort_by = request.query_params.get('sort_by', 'newest').strip()

        users = User.objects.all()

        if account_status == 'active':
            users = users.filter(is_active=True)
        elif account_status == 'blocked':
            users = users.filter(is_active=False)

        if role and role != 'all':
            users = users.filter(roles__icontains=role)

        if search:
            users = users.filter(
                Q(username__icontains=search) |
                Q(phone__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        if pass_filter:
            if pass_filter == 'has_active_pass':
                active_user_ids = BuyerSubscription.objects.filter(status='active', credits_remaining__gt=0).values_list('buyer_id', flat=True)
                users = users.filter(id__in=active_user_ids)
            elif pass_filter == 'no_pass':
                active_user_ids = BuyerSubscription.objects.filter(status='active', credits_remaining__gt=0).values_list('buyer_id', flat=True)
                users = users.exclude(id__in=active_user_ids)
            elif pass_filter in ['starter_39', 'smart_79', 'pro_129', 'single_14']:
                user_ids = BuyerSubscription.objects.filter(pass_type=pass_filter).values_list('buyer_id', flat=True)
                users = users.filter(id__in=user_ids)

        if listing_filter:
            if listing_filter == 'has_active':
                owner_ids = Property.objects.filter(status='active').values_list('owner_id', flat=True)
                users = users.filter(id__in=owner_ids)
            elif listing_filter == 'has_pending':
                owner_ids = Property.objects.filter(status='pending').values_list('owner_id', flat=True)
                users = users.filter(id__in=owner_ids)
            elif listing_filter == 'no_listings':
                owner_ids = Property.objects.values_list('owner_id', flat=True)
                users = users.exclude(id__in=owner_ids)

        if sort_by == 'oldest':
            users = users.order_by('date_joined')
        elif sort_by == 'name':
            users = users.order_by('first_name', 'username')
        else:
            users = users.order_by('-date_joined')

        crm_data = []
        for u in users:
            def get_prop_title(p):
                loc_str = p.locality.name if p.locality else ''
                city_str = p.locality.city.name if (p.locality and p.locality.city) else ''
                loc_full = f"{loc_str}, {city_str}".strip(', ')
                p_type = p.get_property_type_display() if hasattr(p, 'get_property_type_display') else p.property_type
                return f"{p_type} in {loc_full}" if loc_full else p_type

            # Gather Buyer Stats
            buyer_unlocks = Unlock.objects.filter(buyer=u, status='paid')
            total_unlock_spent = buyer_unlocks.aggregate(total=Sum('amount'))['total'] or 0.00
            active_sub = BuyerSubscription.objects.filter(buyer=u, status='active').order_by('-created_at').first()

            unlocked_list = [{
                'id': un.id,
                'property_id': un.property.id,
                'property_title': get_prop_title(un.property),
                'amount': float(un.amount),
                'unlocked_at': un.unlocked_at
            } for un in buyer_unlocks[:5]]

            # Gather Owner Stats
            owner_props = Property.objects.filter(owner=u)
            active_props = owner_props.filter(status='active').count()
            pending_props = owner_props.filter(status='pending').count()
            
            # Total leads received on owner's properties
            leads_received = Unlock.objects.filter(property__owner=u, status='paid').count()

            prop_list = [{
                'id': p.id,
                'title': get_prop_title(p),
                'status': p.status,
                'city': p.locality.city.name if (p.locality and p.locality.city) else '',
                'listing_type': p.property_type,
                'created_at': p.created_at
            } for p in owner_props[:5]]

            crm_data.append({
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'email': u.email,
                'phone': u.phone,
                'role': u.roles[0] if isinstance(u.roles, list) and len(u.roles) > 0 else (str(u.roles) if u.roles else 'user'),
                'roles': u.roles if isinstance(u.roles, list) else [str(u.roles)],
                'is_active': u.is_active,
                'date_joined': u.date_joined,

                'buyer_stats': {
                    'total_unlocks_count': buyer_unlocks.count(),
                    'total_spent': float(total_unlock_spent),
                    'active_pass': {
                        'pass_type': active_sub.pass_type if active_sub else None,
                        'credits_remaining': active_sub.credits_remaining if active_sub else 0,
                        'status': active_sub.status if active_sub else 'No Active Pass',
                        'expires_at': active_sub.expires_at if active_sub else None,
                    } if active_sub else None,
                    'recent_unlocks': unlocked_list
                },

                'owner_stats': {
                    'total_properties_listed': owner_props.count(),
                    'active_properties_count': active_props,
                    'pending_properties_count': pending_props,
                    'total_leads_received': leads_received,
                    'listed_properties': prop_list
                }
            })

        if sort_by == 'most_spent':
            crm_data.sort(key=lambda item: item['buyer_stats']['total_spent'], reverse=True)
        elif sort_by == 'most_listings':
            crm_data.sort(key=lambda item: item['owner_stats']['total_properties_listed'], reverse=True)

        return Response(crm_data)


class AdminUserToggleStatusView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            target_user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_user.is_active = not target_user.is_active
        target_user.save()
        return Response({
            'detail': f"User @{target_user.username} is now {'Active' if target_user.is_active else 'Blocked'}.",
            'is_active': target_user.is_active
        })


