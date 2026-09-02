from rest_framework import views, status
from rest_framework.response import Response
from accounts.permissions import IsAdmin
from properties.models import Property
from unlocks.models import Unlock
from accounts.models import User
from django.db.models import Count, Sum, Q, F, Avg, ExpressionWrapper, fields
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta

class AnalyticsSummaryView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        city_id = request.query_params.get('city_id')

        property_filter = Q()
        unlock_filter = Q()
        agent_filter = Q(roles__contains=['agent']) | Q(roles__contains='agent')

        if city_id:
            property_filter &= Q(locality__city_id=city_id)
            unlock_filter &= Q(property__locality__city_id=city_id)
            agent_filter &= Q(assigned_cities__id=city_id)

        # 1. Total live listings
        total_live = Property.objects.filter(property_filter, status='live').count()

        # 2. Total unlocks and revenue this month + all time
        # 2. Total unlocks and revenue this month + all time
        from unlocks.models import OwnerListingPass, BuyerSubscription
        
        unlocks_this_month = Unlock.objects.filter(unlock_filter, status='paid', unlocked_at__gte=start_of_month)
        total_unlocks = unlocks_this_month.count()
        total_revenue = unlocks_this_month.aggregate(total=Sum('amount'))['total'] or 0

        buyer_passes_this_month = BuyerSubscription.objects.filter(status='active', created_at__gte=start_of_month)
        total_revenue += buyer_passes_this_month.aggregate(total=Sum('amount_paid'))['total'] or 0
        
        passes_this_month = OwnerListingPass.objects.filter(status__in=['active', 'depleted'], created_at__gte=start_of_month)
        if city_id:
            passes_this_month = passes_this_month.filter(owner__owned_properties__locality__city_id=city_id).distinct()
        total_revenue += passes_this_month.aggregate(total=Sum('amount_paid'))['total'] or 0

        unlocks_all_time_qs = Unlock.objects.filter(unlock_filter, status='paid')
        total_unlocks_all_time = unlocks_all_time_qs.count()
        total_revenue_all_time = unlocks_all_time_qs.aggregate(total=Sum('amount'))['total'] or 0

        buyer_passes_all_time = BuyerSubscription.objects.filter(status='active')
        total_revenue_all_time += buyer_passes_all_time.aggregate(total=Sum('amount_paid'))['total'] or 0
        
        passes_all_time = OwnerListingPass.objects.filter(status__in=['active', 'depleted'])
        if city_id:
            passes_all_time = passes_all_time.filter(owner__owned_properties__locality__city_id=city_id).distinct()
        total_revenue_all_time += passes_all_time.aggregate(total=Sum('amount_paid'))['total'] or 0

        # 3. Chart: Combined daily revenue per day over the last 30 days
        daily_rev_dict = {}
        
        # Unlocks daily
        for u in Unlock.objects.filter(unlock_filter, status='paid', unlocked_at__gte=thirty_days_ago) \
                .annotate(date=TruncDate('unlocked_at')).values('date').annotate(count=Count('id'), total=Sum('amount')):
            d_str = u['date'].strftime('%Y-%m-%d')
            daily_rev_dict.setdefault(d_str, {'count': 0, 'total_rev': 0.0})
            daily_rev_dict[d_str]['count'] += u['count']
            daily_rev_dict[d_str]['total_rev'] += float(u['total'] or 0)

        # Buyer Passes daily
        for bp in BuyerSubscription.objects.filter(status='active', created_at__gte=thirty_days_ago) \
                .annotate(date=TruncDate('created_at')).values('date').annotate(count=Count('id'), total=Sum('amount_paid')):
            d_str = bp['date'].strftime('%Y-%m-%d')
            daily_rev_dict.setdefault(d_str, {'count': 0, 'total_rev': 0.0})
            daily_rev_dict[d_str]['count'] += bp['count']
            daily_rev_dict[d_str]['total_rev'] += float(bp['total'] or 0)

        # Owner Passes daily
        for op in OwnerListingPass.objects.filter(status__in=['active', 'depleted'], created_at__gte=thirty_days_ago) \
                .annotate(date=TruncDate('created_at')).values('date').annotate(count=Count('id'), total=Sum('amount_paid')):
            d_str = op['date'].strftime('%Y-%m-%d')
            daily_rev_dict.setdefault(d_str, {'count': 0, 'total_rev': 0.0})
            daily_rev_dict[d_str]['count'] += op['count']
            daily_rev_dict[d_str]['total_rev'] += float(op['total'] or 0)

        unlocks_chart = [
            {'date': k, 'count': v['count'], 'total_rev': round(v['total_rev'], 2)}
            for k, v in sorted(daily_rev_dict.items())
        ]

        # 4. Chart: Listings by status
        listings_by_status = Property.objects.filter(property_filter).values('status').annotate(count=Count('id')).order_by('status')
        status_chart = [{'status': entry['status'].replace('_', ' ').title(), 'count': entry['count']} for entry in listings_by_status]

        # SLA Tracking: Average Review Time (Hours)
        reviewed_props = Property.objects.filter(property_filter, reviewed_at__isnull=False, reviewed_at__gte=thirty_days_ago)
        avg_duration = reviewed_props.aggregate(
            avg_diff=Avg(ExpressionWrapper(F('reviewed_at') - F('created_at'), output_field=fields.DurationField()))
        )['avg_diff']
        avg_review_hours = round(avg_duration.total_seconds() / 3600, 1) if avg_duration else 0

        # SLA Chart: Average Review Time per day over last 30 days
        review_time_last_30 = reviewed_props.annotate(date=TruncDate('reviewed_at')).values('date').annotate(
            avg_diff=Avg(ExpressionWrapper(F('reviewed_at') - F('created_at'), output_field=fields.DurationField()))
        ).order_by('date')
        
        sla_chart = []
        for entry in review_time_last_30:
            sla_chart.append({
                'date': entry['date'].strftime('%Y-%m-%d'),
                'avg_hours': round(entry['avg_diff'].total_seconds() / 3600, 1) if entry['avg_diff'] else 0
            })

        # 5. Table: Top 10 properties by unlock count
        top_properties = Property.objects.filter(property_filter).annotate(
            unlock_count=Count('unlocks', filter=Q(unlocks__status='paid'))
        ).order_by('-unlock_count')[:10]
        
        top_properties_data = [{
            'id': p.id,
            'owner_name': p.owner_name,
            'property_type': p.property_type,
            'status': p.status,
            'unlock_count': p.unlock_count
        } for p in top_properties]

        agent_prop_filter = Q()
        if city_id:
            agent_prop_filter &= Q(agent_properties__locality__city_id=city_id)

        agents_ranked = User.objects.filter(agent_filter).distinct().annotate(
            submitted_count=Count('agent_properties', filter=agent_prop_filter),
            approved_count=Count('agent_properties', filter=Q(agent_properties__status__in=['live', 'sold', 'rented']) & agent_prop_filter)
        ).order_by('-submitted_count')

        from unlocks.models import Feedback
        
        agents_data = []
        for a in agents_ranked:
            feedbacks = Feedback.objects.filter(unlock__property__agent=a)
            total = feedbacks.count()
            trust_score = None
            if total > 0:
                accurate = feedbacks.filter(is_accurate=True).count()
                trust_score = round((accurate / total) * 100)
                
            agents_data.append({
                'id': a.id,
                'username': a.username,
                'submitted_count': a.submitted_count,
                'approved_count': a.approved_count,
                'fraud_flag_count': getattr(a, 'fraud_flag_count', 0),
                'trust_score': trust_score
            })

        # PG Resident Occupancy Analytics
        pg_qs = Property.objects.filter(
            property_filter,
            Q(property_category='pg') | Q(property_type__icontains='pg')
        )
        total_pg_properties = pg_qs.count()
        pg_aggregates = pg_qs.aggregate(
            total_cap=Sum('total_beds'),
            total_avail=Sum('available_beds')
        )
        total_pg_capacity = pg_aggregates['total_cap'] or 0
        total_pg_free_beds = pg_aggregates['total_avail'] or 0
        total_pg_residents = max(0, total_pg_capacity - total_pg_free_beds)
        pg_occupancy_rate = round((total_pg_residents / total_pg_capacity * 100), 1) if total_pg_capacity > 0 else 0.0

        return Response({
            'metrics': {
                'total_live_listings': total_live,
                'total_unlocks_this_month': total_unlocks,
                'total_revenue_this_month': total_revenue,
                'total_unlocks_all_time': total_unlocks_all_time,
                'total_revenue_all_time': total_revenue_all_time,
                'avg_review_hours_last_30d': avg_review_hours,
                'total_pg_properties': total_pg_properties,
                'total_pg_capacity': total_pg_capacity,
                'total_pg_residents': total_pg_residents,
                'total_pg_free_beds': total_pg_free_beds,
                'pg_occupancy_rate': pg_occupancy_rate,
            },
            'charts': {
                'unlocks_per_day': unlocks_chart,
                'listings_by_status': status_chart,
                'review_time_sla': sla_chart
            },
            'tables': {
                'top_properties': top_properties_data,
                'agents_ranked': agents_data
            }
        })
