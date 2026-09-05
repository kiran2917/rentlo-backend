from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from datetime import datetime

import time
import os
from django.db import connection
from django.core.cache import cache

def health_check(request):
    """
    Real-time Health & Telemetry Diagnostic Endpoint
    Dynamically identifies hosting platform (Render, VPS, AWS, Local) and reports live vitals.
    """
    # Detect hosting platform dynamically
    host_header = request.get_host()
    if os.getenv('RENDER') or os.getenv('RENDER_SERVICE_ID') or 'onrender.com' in host_header:
        provider_name = 'Render Cloud Platform'
        provider_type = 'render'
        region_info = os.getenv('RENDER_REGION', 'US-East Cloud')
    elif os.getenv('IS_VPS') or os.getenv('VPS_ENV') or os.path.exists('/etc/nginx'):
        provider_name = 'Dedicated VPS Server'
        provider_type = 'vps'
        region_info = 'Ubuntu / Nginx Dedicated Node'
    elif 'aws' in host_header or os.getenv('AWS_EXECUTION_ENV'):
        provider_name = 'Amazon Web Services (AWS)'
        provider_type = 'aws'
        region_info = os.getenv('AWS_REGION', 'Cloud Instance')
    else:
        provider_name = 'Local Development Server'
        provider_type = 'local'
        region_info = '127.0.0.1 / Localhost'

    health_data = {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'environment': getattr(settings, 'HOST_ENVIRONMENT', 'production'),
        'deployment': {
            'provider': provider_name,
            'type': provider_type,
            'region': region_info,
            'host': host_header,
            'server_protocol': request.scheme.upper(),
        },
        'telemetry': {
            'sentry_configured': bool(getattr(settings, 'SENTRY_DSN', None)),
            'traces_sample_rate': getattr(settings, 'SENTRY_TRACES_SAMPLE_RATE', 0.2),
            'apm_active': bool(getattr(settings, 'SENTRY_DSN', None)),
        },
        'services': {}
    }
    
    # 1. Database Ping & Latency Check
    db_start = time.time()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        health_data['services']['database'] = {
            'status': 'connected',
            'latency_ms': round((time.time() - db_start) * 1000, 2),
            'engine': connection.vendor.upper(),
            'name': connection.settings_dict.get('NAME', 'default')
        }
    except Exception as e:
        health_data['status'] = 'degraded'
        health_data['services']['database'] = {
            'status': 'error',
            'error': str(e)
        }

    # 2. Redis / Cache Check
    cache_start = time.time()
    try:
        cache.set('__telemetry_ping__', '1', 5)
        is_cached = cache.get('__telemetry_ping__') == '1'
        health_data['services']['cache'] = {
            'status': 'connected' if is_cached else 'unavailable',
            'latency_ms': round((time.time() - cache_start) * 1000, 2),
            'backend': cache.__class__.__name__
        }
    except Exception:
        health_data['services']['cache'] = {
            'status': 'unavailable'
        }

    # 3. Hardware / System Vitals (VPS / Container metrics)
    try:
        import psutil
        health_data['system'] = {
            'cpu_percent': psutil.cpu_percent(interval=None),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_percent': psutil.disk_usage('/').percent if os.name != 'nt' else psutil.disk_usage('C:\\').percent
        }
    except Exception:
        health_data['system'] = {
            'cpu_percent': None,
            'memory_percent': None,
            'disk_percent': None
        }

    status_code = 200 if health_data['status'] == 'healthy' else 503
    return JsonResponse(health_data, status=status_code)



from unlocks.views import RazorpayWebhookView
from earnings.views import AgentEarningsSummaryView
from properties.views_seo import property_seo_view
from properties.views_sitemap import robots_txt_view, sitemap_xml_view

from django.conf import settings
from django.conf.urls.static import static

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/health/', health_check, name='health_check'),
    
    # Search Engine Crawler Optimization Endpoints
    path('robots.txt', robots_txt_view, name='robots-txt'),
    path('sitemap.xml', sitemap_xml_view, name='sitemap-xml'),

    # OpenAPI 3.0 Auto-Generated Schema & Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/accounts/', include('accounts.urls')),
    path('api/v1/properties/', include('properties.urls')),
    path('api/v1/moderation/', include('moderation.urls')),
    path('api/v1/notifications/', include('notifications.urls')),
    path('api/v1/media/', include('media.urls')),
    path('api/v1/analytics/', include('analytics.urls')),
    path('api/v1/earnings/', include('earnings.urls')),
    path('api/v1/chat/', include('chat.urls')),
    path('api/v1/visits/', include('visits.urls')),
    path('api/v1/agents/<int:id>/earnings-summary/', AgentEarningsSummaryView.as_view(), name='root-agent-earnings-summary'),
    path('api/v1/', include('unlocks.urls')),
    path('api/v1/webhooks/razorpay/', RazorpayWebhookView.as_view(), name='razorpay-webhook'),
    path('property/<int:id>', property_seo_view, name='property-seo-view'),
    path('property/<int:id>/', property_seo_view, name='property-seo-view-slash'),
]

# Serve media files in both debug and production mode for local storage fallback
from django.views.static import serve
from django.urls import re_path

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {
        'document_root': settings.MEDIA_ROOT,
    }),
]
