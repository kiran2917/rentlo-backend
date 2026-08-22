from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum
from .models import EarningEntry, AgentPayoutBatch
import logging

logger = logging.getLogger(__name__)

@shared_task
def generate_weekly_payouts():
    """
    Run every Monday at 2:00 AM.
    Bundles all unpaid EarningEntry objects (pending or approved) from the past into an AgentPayoutBatch.
    """
    now = timezone.now()
    
    # We define the cycle as all unpaid entries up to this moment.
    # In a strict Mon-Sun setup running on Monday morning, "now" is the cutoff.
    unpaid_entries = EarningEntry.objects.filter(payout_batch__isnull=True, status__in=['pending', 'approved'])
    
    if not unpaid_entries.exists():
        logger.info("No unpaid earning entries found for batching.")
        return 0
        
    # Group by agent
    agent_ids = unpaid_entries.values_list('agent_id', flat=True).distinct()
    
    batches_created = 0
    for agent_id in agent_ids:
        agent_entries = unpaid_entries.filter(agent_id=agent_id)
        
        # Calculate total amount
        total_amount = agent_entries.aggregate(total=Sum('amount'))['total'] or 0
        
        if total_amount > 0:
            # Find cycle start (earliest entry in this batch)
            earliest_entry = agent_entries.order_by('created_at').first()
            cycle_start = earliest_entry.created_at.date() if earliest_entry else (now - timedelta(days=7)).date()
            cycle_end = now.date()
            
            # Create Payout Batch
            batch = AgentPayoutBatch.objects.create(
                agent_id=agent_id,
                cycle_start_date=cycle_start,
                cycle_end_date=cycle_end,
                total_amount=total_amount,
                status='processing'
            )
            
            # Link entries to batch and mark them as processing (to reflect they are in a batch)
            # We can leave them as 'approved' or 'pending', but the payout_batch linkage is the key.
            agent_entries.update(payout_batch=batch)
            batches_created += 1
            
    logger.info(f"Successfully generated {batches_created} AgentPayoutBatch records.")
    return batches_created
