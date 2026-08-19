from django.urls import path
from .views import PresignedURLView, UploadMediaView, UploadVoiceNoteView

urlpatterns = [
    path('upload-url/', PresignedURLView.as_view(), name='presigned-url'),
    path('upload/', UploadMediaView.as_view(), name='upload-media'),
    path('upload/voice-note/', UploadVoiceNoteView.as_view(), name='upload-voice-note'),
]
