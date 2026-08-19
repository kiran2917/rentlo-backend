from django.urls import path
from .views import ChatMessagesView, ChatThreadsView, UnreadCountView

urlpatterns = [
    path('threads/', ChatThreadsView.as_view(), name='chat-threads'),
    path('unread/', UnreadCountView.as_view(), name='chat-unread'),
    path('property/<int:property_id>/', ChatMessagesView.as_view(), name='chat-messages'),
]
