from django.urls import path
from .views import (
    CommissionRuleListCreateView,
    CommissionRuleDetailView,
    EarningEntryListView,
    ApproveEarningView,
    MarkPaidEarningView,
    AgentEarningsSummaryView
)

urlpatterns = [
    path('commission-rules/', CommissionRuleListCreateView.as_view(), name='commission-rule-list-create'),
    path('commission-rules/<int:pk>/', CommissionRuleDetailView.as_view(), name='commission-rule-detail'),
    path('', EarningEntryListView.as_view(), name='earning-list'),
    path('<int:id>/approve/', ApproveEarningView.as_view(), name='earning-approve'),
    path('<int:id>/mark-paid/', MarkPaidEarningView.as_view(), name='earning-mark-paid'),
    path('agents/<int:id>/earnings-summary/', AgentEarningsSummaryView.as_view(), name='agent-earnings-summary'),
]
