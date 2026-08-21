from django.urls import path
from .views import (
    NotificationListView,
    NotificationReadView,
    VapidPublicKeyView,
    SubscribeWebPushView,
    UnsubscribeWebPushView
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('<int:pk>/read/', NotificationReadView.as_view(), name='notification-read'),
    path('vapid-public-key/', VapidPublicKeyView.as_view(), name='vapid-public-key'),
    path('subscribe-web-push/', SubscribeWebPushView.as_view(), name='subscribe-web-push'),
    path('unsubscribe-web-push/', UnsubscribeWebPushView.as_view(), name='unsubscribe-web-push'),
]
