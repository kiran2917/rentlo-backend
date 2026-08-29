from django.urls import path
from .views import (
    CommissionRuleListCreateView,
    CommissionRuleDetailView,
    EarningEntryListView,
    ApproveEarningView,
    MarkPaidEarningView,
    AgentEarningsSummaryView,
    AgentPayoutBatchListView,
    MarkPayoutBatchPaidView,
    AgentPayoutBatchReceiptView,
    DisburseInstantPayoutView,
    CreateInstantPayoutBatchView
)

urlpatterns = [
    path('commission-rules/', CommissionRuleListCreateView.as_view(), name='commission-rule-list-create'),
    path('commission-rules/<int:pk>/', CommissionRuleDetailView.as_view(), name='commission-rule-detail'),
    path('', EarningEntryListView.as_view(), name='earning-list'),
    path('<int:id>/approve/', ApproveEarningView.as_view(), name='earning-approve'),
    path('<int:id>/mark-paid/', MarkPaidEarningView.as_view(), name='earning-mark-paid'),
    path('agents/<int:id>/earnings-summary/', AgentEarningsSummaryView.as_view(), name='agent-earnings-summary'),
    path('payout-batches/', AgentPayoutBatchListView.as_view(), name='payout-batch-list'),
    path('payout-batches/create-instant/', CreateInstantPayoutBatchView.as_view(), name='payout-batch-create-instant'),
    path('payout-batches/<int:id>/disburse-instant/', DisburseInstantPayoutView.as_view(), name='payout-batch-disburse-instant'),
    path('payout-batches/<int:id>/mark-paid/', MarkPayoutBatchPaidView.as_view(), name='payout-batch-mark-paid'),
    path('payout-batches/<int:id>/receipt/', AgentPayoutBatchReceiptView.as_view(), name='payout-batch-receipt'),
]
