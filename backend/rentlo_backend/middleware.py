import traceback
import logging
import time

django_logger = logging.getLogger('django')
performance_logger = logging.getLogger('performance')
requests_logger = logging.getLogger('requests')

class ExceptionLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        django_logger.error(
            f"EXCEPTION on {request.path}\n"
            f"{traceback.format_exc()}"
        )
        return None

class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()
        
        response = self.get_response(request)
        
        duration = time.time() - start_time
        duration_ms = duration * 1000

        user = request.user.username if request.user.is_authenticated else 'Anonymous'
        
        log_message = f"[{request.method}] {request.get_full_path()} - Status: {response.status_code} - User: {user} - {duration_ms:.2f}ms"
        
        # Log every request to request.log
        requests_logger.info(log_message)
        
        # If it takes more than 500ms, log it as a performance warning
        if duration_ms > 500:
            performance_logger.warning(f"SLOW REQUEST: {log_message}")

        return response


class SecurityHeadersMiddleware:
    """
    Adds security headers to every HTTP response:
    - Content-Security-Policy (CSP): Restricts sources for scripts, images, API calls
    - Referrer-Policy: Limits referrer info sent to external sites
    - Permissions-Policy: Disables unnecessary browser APIs
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Content Security Policy
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com; "
            "img-src 'self' data: blob: https://*.r2.dev https://images.unsplash.com https://pub-*.r2.dev; "
            "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com; "
            "frame-src https://api.razorpay.com https://checkout.razorpay.com; "
            "object-src 'none'; "
            "base-uri 'self';"
        )

        # Limit referrer info sent to third-party sites
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Disable sensitive browser features not needed by the app
        response['Permissions-Policy'] = (
            'geolocation=(self), '
            'camera=(), '
            'microphone=(), '
            'payment=(self "https://checkout.razorpay.com")'
        )

        # Prevent MIME type sniffing
        response['X-Content-Type-Options'] = 'nosniff'

        return response
