from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.conf import settings

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        raw_token = None
        
        if header is not None:
            raw_token = self.get_raw_token(header)
            
        if raw_token is None:
            raw_token = (
                request.COOKIES.get('access_token') or 
                request.COOKIES.get(settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')) or 
                request.COOKIES.get('jwt_access_token') or
                None
            )
            
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            if user and user.is_active:
                return user, validated_token
            return None
        except Exception:
            # If the token is invalid or expired, treat as unauthenticated
            return None


from drf_spectacular.extensions import OpenApiAuthenticationExtension

class CookieJWTScheme(OpenApiAuthenticationExtension):
    target_class = 'accounts.authentication.CookieJWTAuthentication'
    name = 'cookieAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'cookie',
            'name': settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token'),
        }

