from django.urls import path
from .views import ModeratePropertyView, AgentFraudListView
from .views_suspend import SuspendAgentView

urlpatterns = [
    path('properties/<int:property_id>/moderate/', ModeratePropertyView.as_view(), name='moderate-property'),
    path('agents/fraud/', AgentFraudListView.as_view(), name='agent-fraud-list'),
    path('agents/<int:pk>/suspend/', SuspendAgentView.as_view(), name='suspend-agent'),
]
