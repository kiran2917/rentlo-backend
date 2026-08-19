from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from datetime import datetime

def health_check(request):
    return JsonResponse({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

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

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
