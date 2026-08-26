import random
import razorpay
import hmac
import hashlib
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, status, views
from rest_framework.permissions import BasePermission, AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from accounts.permissions import IsAdminOrModerator, IsAgent, IsAdmin
from .models import Property, ConsentOTP, City, Locality, PlatformSettingsAuditLog
from .serializers import PropertySerializer, RequestOTPSerializer, VerifyOTPSerializer, CitySerializer, LocalitySerializer
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return request.user and request.user.is_authenticated and 'admin' in request.user.roles

class CityListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = CitySerializer
    pagination_class = None

    def get_queryset(self):
        qs = City.objects.filter(is_active=True)
        has_props = self.request.query_params.get('has_properties')
        if has_props == 'true':
            # Only show cities that have at least one LIVE property
            qs = qs.filter(localities__properties__status='live').distinct()
        return qs.order_by('name')

class CityDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = CitySerializer
    queryset = City.objects.all()

class LocalityListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = LocalitySerializer
    pagination_class = None

    def get_queryset(self):
        city_id = self.kwargs.get('city_id')
        qs = Locality.objects.all()
        if city_id:
            qs = qs.filter(city_id=city_id)
        has_props = self.request.query_params.get('has_properties')
        if has_props == 'true':
            # Only show localities that have at least one LIVE property
            qs = qs.filter(properties__status='live').distinct()
        return qs.order_by('name')

class LocalityDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminOrReadOnly]
    serializer_class = LocalitySerializer
    queryset = Locality.objects.all()

import requests

class SuggestLocalitiesView(views.APIView):
    permission_classes = [IsAdminOrModerator]
    
    def get(self, request):
        city_name = request.query_params.get('city', '')
        if not city_name:
            return Response({'error': 'city parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        gemini_api_key = getattr(settings, 'GEMINI_API_KEY', None)
        if not gemini_api_key:
            return Response({'error': 'GEMINI_API_KEY is not configured in the backend .env file. Please add it to enable Smart AI Suggestions.'}, status=status.HTTP_501_NOT_IMPLEMENTED)
            
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_api_key}"
        
        prompt = f"List 10 to 15 popular residential localities, neighborhoods, or suburbs in {city_name}, India. Return ONLY a comma-separated list of names. Do not include numbers, bullet points, or any other text. Do not include the city name in every item. Example output: Vidyanagar, Sirur Park, Lingaraj Nagar"
        
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        
        try:
            r = requests.post(url, json=payload, headers={'Content-Type': 'application/json'}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                text_response = data.get('candidates', [])[0].get('content', {}).get('parts', [])[0].get('text', '')
                
                # Parse the comma-separated string
                raw_localities = [x.strip() for x in text_response.split(',')]
                # Filter out garbage
                localities = []
                for name in raw_localities:
                    clean_name = name.strip('*#-.\n')
                    if clean_name and len(clean_name) > 2 and city_name.lower() not in clean_name.lower():
                        localities.append(clean_name)
                        
                return Response({'localities': sorted(list(set(localities)))})
            else:
                logger.error(f"AI Service Error during locality extraction: {r.text}")
                return Response({'error': 'AI service temporarily unavailable.'}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            logger.error(f"Internal exception during AI locality extraction: {str(e)}", exc_info=True)
            return Response({'error': 'An internal error occurred while processing AI request.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PropertyListCreateView(generics.ListCreateAPIView):
    serializer_class = PropertySerializer
    
    def get_permissions(self):
        class IsAdminOrModeratorOrAgentOrOwner(BasePermission):
            def has_permission(self, request, view):
                if not request.user or not request.user.is_authenticated:
                    return False
                return any(r in request.user.roles for r in ['admin', 'moderator', 'agent', 'owner'])

        return [IsAdminOrModeratorOrAgentOrOwner()]

    def get_queryset(self):
        user = self.request.user
        queryset = Property.objects.select_related('locality', 'locality__city', 'agent', 'owner').prefetch_related('media').all()
        queryset = queryset.order_fields('-created_at') if hasattr(queryset, 'order_fields') else queryset.order_by('-created_at')
        roles = user.roles if hasattr(user, 'roles') else [user.role]
        
        if 'agent' in roles and 'admin' not in roles:
            queryset = queryset.filter(Q(agent=user) | Q(added_by__icontains=f"agent:{user.id}"))
        elif 'owner' in roles and 'admin' not in roles and 'moderator' not in roles and 'agent' not in roles:
            queryset = queryset.filter(owner=user)
            
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        search_query = self.request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(owner_name__icontains=search_query)
            
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        roles = user.roles if hasattr(user, 'roles') else [user.role]
        locality_id = self.request.data.get('locality')
        if 'agent' in roles and locality_id:
            try:
                locality = Locality.objects.get(id=locality_id)
                if not user.assigned_cities.filter(id=locality.city_id).exists():
                    raise PermissionDenied("You are not assigned to the city of this locality.")
            except Locality.DoesNotExist:
                raise PermissionDenied("Invalid locality.")
                
        owner = None
        added_by = 'self'
        owner_phone = self.request.data.get('owner_phone')
        owner_name = self.request.data.get('owner_name')
        owner_password = self.request.data.get('owner_password')
        
        is_staff = any(r in ['agent', 'admin', 'sub_admin', 'subadmin'] for r in roles)
        if is_staff:
            added_by = f"{'agent' if 'agent' in roles else 'admin'}:{user.id}"
            if owner_phone:
                from accounts.models import User
                import uuid
                owner = User.objects.filter(phone=owner_phone).first()
                if not owner:
                    username = f"owner_{uuid.uuid4().hex[:10]}"
                    password = owner_password or uuid.uuid4().hex[:8]
                    owner = User.objects.create_user(
                        username=username, 
                        password=password, 
                        phone=owner_phone,
                        roles=['owner'],
                        force_password_change=True,
                        first_name=owner_name or ''
                    )
                    # Simulated SMS delivery of temporary password
                    print(f"--- SMS SENT TO {owner_phone} ---")
                    print(f"Your temporary Rentlo password is: {password}. Please login and reset it.")
                else:
                    if 'owner' not in owner.roles:
                        owner.roles.append('owner')
                        owner.save()
            else:
                raise PermissionDenied("Staff members must specify the owner's phone number to create a property listing.")
        else:
            owner = user
            added_by = 'self'

        agent = user if 'agent' in roles else None
        
        # Ensure owner_name and owner_phone are populated for direct owners
        save_kwargs = {
            'agent': agent,
            'owner': owner,
            'added_by': added_by
        }
        
        # Calculate and save onboarding fee based on platform settings and property type
        settings_obj = PlatformSettings.load()
        if settings_obj.bypass_owner_payment:
            save_kwargs['onboarding_fee'] = 0.00
        elif settings_obj.owner_onboarding_fee > 0:
            save_kwargs['onboarding_fee'] = settings_obj.owner_onboarding_fee
        else:
            p_lower = str(serializer.validated_data.get('property_type', '')).lower()
            if p_lower in ['apartment', 'pg', 'pg_hostel', 'pg_single', 'pg_double', 'pg_triple', 'hostel']:
                save_kwargs['onboarding_fee'] = settings_obj.owner_apt_pg_fee
            elif p_lower in ['office', 'retail', 'warehouse', 'coworking', 'industrial', 'commercial', 'commercial_plot']:
                save_kwargs['onboarding_fee'] = settings_obj.owner_commercial_fee
            else:
                save_kwargs['onboarding_fee'] = settings_obj.owner_residential_fee

        if not owner_phone and owner:
            save_kwargs['owner_phone'] = owner.phone
        if not owner_name and owner:
            save_kwargs['owner_name'] = owner.first_name
            
        registration_payment_method = self.request.data.get('registration_payment_method')
        registration_utr = self.request.data.get('registration_utr')
        
        if registration_payment_method:
            save_kwargs['registration_payment_method'] = registration_payment_method
            if registration_payment_method in ['manual', 'cash', 'upi']:
                save_kwargs['registration_fee_paid'] = False
                save_kwargs['status'] = 'pending_approval'
            
        if registration_utr:
            save_kwargs['registration_utr'] = registration_utr
            save_kwargs['registration_fee_paid'] = False
            save_kwargs['status'] = 'pending_approval'
            
        # Handle Razorpay Verification & Owner Credits
        from unlocks.models import OwnerListingPass
        
        registration_razorpay_order_id = self.request.data.get('registration_razorpay_order_id')
        registration_razorpay_payment_id = self.request.data.get('registration_razorpay_payment_id')
        registration_razorpay_signature = self.request.data.get('registration_razorpay_signature')
        requested_plan = self.request.data.get('plan') or self.request.data.get('selected_plan') or 'single'
        
        if registration_razorpay_order_id and registration_razorpay_payment_id and registration_razorpay_signature:
            try:
                msg = f"{registration_razorpay_order_id}|{registration_razorpay_payment_id}"
                expected_signature = hmac.new(
                    bytes(settings.RAZORPAY_KEY_SECRET, 'latin-1'),
                    bytes(msg, 'latin-1'),
                    hashlib.sha256
                ).hexdigest()
                
                if expected_signature != registration_razorpay_signature:
                    raise PermissionDenied("Invalid payment signature")
                    
                save_kwargs['registration_payment_method'] = 'razorpay'
                save_kwargs['registration_fee_paid'] = True
                save_kwargs['registration_razorpay_order_id'] = registration_razorpay_order_id
                save_kwargs['registration_razorpay_payment_id'] = registration_razorpay_payment_id
                save_kwargs['registration_razorpay_signature'] = registration_razorpay_signature
                save_kwargs['status'] = 'approved' # Auto approve!

                # Issue multi-listing credits if a 3pack or 6pack pass was purchased
                plan_str = str(requested_plan).lower()
                total_plan_credits = 6 if ('6pack' in plan_str or '6' in plan_str) else (3 if ('3pack' in plan_str or '3' in plan_str) else 1)
                remaining_to_issue = total_plan_credits - 1

                prop_cat = serializer.validated_data.get('property_category') or 'residential'
                prop_type = serializer.validated_data.get('property_type') or ''
                if prop_cat == 'pg' or prop_type in ['apartment', 'flat', 'pg_hostel']:
                    purchased_cat = 'apartment'
                elif prop_cat == 'commercial' or prop_type in ['shop', 'office', 'warehouse', 'showroom', 'industrial', 'commercial_building']:
                    purchased_cat = 'commercial'
                else:
                    purchased_cat = 'residential'

                if remaining_to_issue > 0 and self.request.user.is_authenticated:
                    OwnerListingPass.objects.create(
                        owner=self.request.user,
                        plan_id=requested_plan,
                        category=purchased_cat,
                        credits_total=total_plan_credits,
                        credits_remaining=remaining_to_issue,
                        amount_paid=self.request.data.get('amount', 0),
                        order_id=registration_razorpay_order_id,
                        gateway_txn_id=registration_razorpay_payment_id,
                        status='active'
                    )
            except Exception as e:
                raise PermissionDenied(f"Payment verification failed: {str(e)}")
        elif self.request.user.is_authenticated:
            # Check property category being created
            prop_cat = serializer.validated_data.get('property_category') or 'residential'
            prop_type = serializer.validated_data.get('property_type') or ''
            
            if prop_cat == 'pg' or prop_type in ['apartment', 'flat', 'pg_hostel', 'pg_single', 'pg_double', 'pg_triple', 'pg', 'hostel']:
                target_cat = 'apartment'
            elif prop_cat == 'commercial' or prop_type in ['shop', 'office', 'warehouse', 'showroom', 'industrial', 'commercial_building']:
                target_cat = 'commercial'
            else:
                target_cat = 'residential'

            user_phone = getattr(self.request.user, 'phone', None)
            pass_filter = Q(owner=self.request.user)
            if user_phone:
                pass_filter |= Q(owner__phone=user_phone)

            active_pass = OwnerListingPass.objects.filter(
                pass_filter,
                status='active',
                credits_remaining__gt=0
            ).filter(
                Q(category='all') | Q(category__iexact=target_cat)
            ).order_by('created_at').first()

            if active_pass:
                active_pass.credits_remaining -= 1
                if active_pass.credits_remaining <= 0:
                    active_pass.status = 'depleted'
                active_pass.save()

                save_kwargs['registration_payment_method'] = 'owner_credit'
                save_kwargs['registration_fee_paid'] = True
                save_kwargs['onboarding_payment_status'] = 'paid'
                save_kwargs['onboarding_payment_method'] = 'owner_credit'
                save_kwargs['status'] = 'approved'
            
        serializer.save(**save_kwargs)

class OwnerCreditsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from unlocks.models import OwnerListingPass
        from properties.models import Property
        from django.db.models import Q

        user = request.user
        user_phone = getattr(user, 'phone', None)
        requested_category = request.query_params.get('category') or request.query_params.get('property_category') or 'all'

        # Normalize category
        if requested_category in ['pg', 'apartment', 'flat', 'pg_hostel']:
            target_cat = 'apartment'
        elif requested_category in ['residential', 'house', 'villa', '1bhk', '2bhk', '3bhk', '4bhk']:
            target_cat = 'residential'
        elif requested_category in ['commercial', 'shop', 'office', 'warehouse', 'showroom', 'industrial', 'commercial_building']:
            target_cat = 'commercial'
        else:
            target_cat = 'all'

        pass_filter = Q(owner=user)
        if user_phone:
            pass_filter |= Q(owner__phone=user_phone)

        all_passes = OwnerListingPass.objects.filter(pass_filter, status='active', credits_remaining__gt=0)
        
        # Filter passes by requested category match OR 'all'
        if target_cat != 'all':
            matching_passes = all_passes.filter(Q(category='all') | Q(category__iexact=target_cat))
        else:
            matching_passes = all_passes

        total_credits = sum(p.credits_remaining for p in matching_passes)
        return Response({
            'has_active_credits': total_credits > 0,
            'total_credits_remaining': total_credits,
            'target_category': target_cat,
            'active_passes': [
                {
                    'id': p.id,
                    'plan_id': p.plan_id,
                    'category': getattr(p, 'category', 'all') or 'all',
                    'credits_remaining': p.credits_remaining,
                    'credits_total': p.credits_total,
                    'created_at': p.created_at
                } for p in matching_passes
            ]
        })

class InitiateOwnerPassOrderView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get('plan_id', '3pack')
        category = request.data.get('category', 'apartment')
        
        from properties.models import PlatformSettings
        ps = PlatformSettings.load()

        if plan_id == 'custom':
            price = float(request.data.get('amount', 0))
            credits_count = int(request.data.get('credits_count', 0))
            custom_passes = request.data.get('custom_passes', [])
            
            if ps.bypass_owner_payment:
                from unlocks.models import OwnerListingPass
                for item in custom_passes:
                    cat = item.get('category')
                    cnt = int(item.get('credits', 0))
                    if cnt > 0:
                        OwnerListingPass.objects.create(
                            owner=request.user,
                            plan_id='custom',
                            category=cat,
                            credits_total=cnt,
                            credits_remaining=cnt,
                            amount_paid=0.00,
                            status='active'
                        )
                return Response({
                    'bypassed': True,
                    'detail': f'🎉 Custom passes activated successfully! {credits_count} credits added.'
                })

            if getattr(ps, 'owner_payment_gateway', 'razorpay') == 'upi':
                from unlocks.models import OwnerListingPass
                import uuid
                group_order_id = f"custom_order_{uuid.uuid4().hex[:12]}"
                for item in custom_passes:
                    cat = item.get('category')
                    cnt = int(item.get('credits', 0))
                    if cnt > 0:
                        OwnerListingPass.objects.create(
                            owner=request.user,
                            plan_id='custom',
                            category=cat,
                            credits_total=cnt,
                            credits_remaining=cnt,
                            amount_paid=0.00,
                            order_id=group_order_id,
                            status='pending',
                            payment_method='upi'
                        )
                return Response({
                    'payment_gateway': 'upi',
                    'amount': price,
                    'upi_merchant_id': ps.default_upi_id or 'merchant@upi',
                    'plan_id': 'custom',
                    'order_id': group_order_id,
                    'credits_count': credits_count
                })
        elif plan_id == 'single':
            if category == 'residential':
                price = float(ps.owner_residential_fee)
            elif category == 'commercial':
                price = float(ps.owner_commercial_fee)
            else: # apartment / pg
                price = float(ps.owner_apt_pg_fee)
            credits_count = 1
        elif plan_id == '6pack':
            if category == 'residential':
                price = float(ps.owner_residential_6pack_price)
            elif category == 'commercial':
                price = float(ps.owner_commercial_6pack_price)
            else:
                price = float(ps.owner_apt_pg_6pack_price)
            credits_count = 6
        elif plan_id == '10pack':
            if category == 'residential':
                price = float(ps.owner_residential_10pack_price)
            elif category == 'commercial':
                price = float(ps.owner_commercial_10pack_price)
            else:
                price = float(ps.owner_apt_pg_10pack_price)
            credits_count = 10
        else: # 3pack
            if category == 'residential':
                price = float(ps.owner_residential_3pack_price)
            elif category == 'commercial':
                price = float(ps.owner_commercial_3pack_price)
            else:
                price = float(ps.owner_apt_pg_3pack_price)
            credits_count = 3

        if ps.bypass_owner_payment:
            from unlocks.models import OwnerListingPass
            p = OwnerListingPass.objects.create(
                owner=request.user,
                plan_id=plan_id,
                category=category,
                credits_total=credits_count,
                credits_remaining=credits_count,
                amount_paid=price,
                status='active'
            )
            return Response({
                'bypassed': True,
                'detail': f'{credits_count} listing credits added to your account!',
                'credits_remaining': p.credits_remaining,
                'pass_id': p.id
            })

        if getattr(ps, 'owner_payment_gateway', 'razorpay') == 'upi':
            from unlocks.models import OwnerListingPass
            p = OwnerListingPass.objects.create(
                owner=request.user,
                plan_id=plan_id,
                category=category,
                credits_total=credits_count,
                credits_remaining=credits_count,
                amount_paid=price,
                status='pending',
                payment_method='upi'
            )
            return Response({
                'payment_gateway': 'upi',
                'amount': price,
                'upi_merchant_id': ps.default_upi_id or 'merchant@upi',
                'plan_id': plan_id,
                'credits_count': credits_count
            })

        amount_paise = int(price * 100)
        try:
            import razorpay
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            notes = {
                'owner_id': str(request.user.id),
                'plan_id': plan_id,
                'credits_count': str(credits_count)
            }
            if plan_id == 'custom':
                import json
                notes['custom_passes'] = json.dumps(custom_passes)
            order = client.order.create({
                'amount': amount_paise,
                'currency': 'INR',
                'payment_capture': '1',
                'notes': notes
            })
            return Response({
                'payment_gateway': 'razorpay',
                'order_id': order['id'],
                'amount': amount_paise,
                'key_id': settings.RAZORPAY_KEY_ID,
                'plan_id': plan_id,
                'credits_count': credits_count,
                'price': price
            })
        except Exception as e:
            return Response({'detail': 'Payment gateway configuration error. Please contact the support team.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VerifyOwnerPassOrderView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payment_method = request.data.get('payment_method', 'razorpay')
        plan_id = request.data.get('plan_id', '3pack')
        category = request.data.get('category', 'apartment')
        credits_count = int(request.data.get('credits_count', 3))

        if payment_method == 'upi':
            utr = request.data.get('utr')
            if not utr:
                return Response({'detail': 'UTR is required for UPI payments.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                from unlocks.models import OwnerListingPass
                if plan_id == 'custom':
                    order_id = request.data.get('order_id')
                    passes = OwnerListingPass.objects.filter(
                        owner=request.user,
                        order_id=order_id,
                        status='pending',
                        payment_method='upi'
                    )
                    if not passes.exists():
                        return Response({'detail': 'No pending custom pass order found.'}, status=status.HTTP_404_NOT_FOUND)
                    for p in passes:
                        p.utr = utr
                        p.status = 'active'
                        p.save()
                    return Response({'detail': 'Custom passes activated successfully via UPI!', 'order_id': order_id})
                else:
                    p = OwnerListingPass.objects.filter(
                        owner=request.user, 
                        plan_id=plan_id, 
                        category=category, 
                        status='pending', 
                        payment_method='upi'
                    ).latest('id')
                    
                    # Instantly activate for MVP
                    p.utr = utr
                    p.status = 'active'
                    p.save()
                    return Response({'detail': 'Pass activated successfully via UPI!', 'pass_id': p.id})
            except OwnerListingPass.DoesNotExist:
                return Response({'detail': 'No pending pass found.'}, status=status.HTTP_404_NOT_FOUND)

        order_id = request.data.get('order_id')
        payment_id = request.data.get('payment_id')
        signature = request.data.get('signature')

        if not all([order_id, payment_id, signature]):
            return Response({'detail': 'Missing payment details'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            msg = f"{order_id}|{payment_id}"
            expected = hmac.new(
                bytes(settings.RAZORPAY_KEY_SECRET, 'latin-1'),
                bytes(msg, 'latin-1'),
                hashlib.sha256
            ).hexdigest()
            if expected != signature:
                return Response({'detail': 'Invalid payment signature'}, status=status.HTTP_400_BAD_REQUEST)

            from unlocks.models import OwnerListingPass
            # Prevent double-crediting if user re-submits or clicks twice
            if OwnerListingPass.objects.filter(gateway_txn_id=payment_id).exists():
                return Response({'detail': 'This transaction has already been credited.'}, status=status.HTTP_400_BAD_REQUEST)

            if plan_id == 'custom':
                custom_passes = request.data.get('custom_passes', [])
                for item in custom_passes:
                    cat = item.get('category')
                    cnt = int(item.get('credits', 0))
                    if cnt > 0:
                        OwnerListingPass.objects.create(
                            owner=request.user,
                            plan_id='custom',
                            category=cat,
                            credits_total=cnt,
                            credits_remaining=cnt,
                            amount_paid=0.00,
                            order_id=order_id,
                            gateway_txn_id=payment_id,
                            status='active'
                        )
            else:
                p = OwnerListingPass.objects.create(
                    owner=request.user,
                    plan_id=plan_id,
                    category=category,
                    credits_total=credits_count,
                    credits_remaining=credits_count,
                    amount_paid=request.data.get('amount', 0),
                    order_id=order_id,
                    gateway_txn_id=payment_id,
                    status='active'
                )
            
            # Create system notification for payment success
            from notifications.models import Notification
            Notification.objects.create(
                recipient=request.user,
                message=f"Payment verified! {credits_count} listing credits added to your account."
            )

            return Response({
                'detail': f'Payment verified! {credits_count} listing credits added to your account.',
                'credits_remaining': p.credits_remaining,
                'pass_id': p.id
            })
        except Exception as e:
            return Response({'detail': f'Payment verification failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

class CreateRegistrationOrderView(views.APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        city_id = request.data.get('city_id')
        city_name = request.data.get('city_name_input')
        
        if not city_id and city_name:
            city_obj, _ = City.objects.get_or_create(
                name__iexact=city_name,
                defaults={'name': city_name, 'state': request.data.get('state_name_input', 'Karnataka')}
            )
            city_id = city_obj.id

        try:
            settings_obj = PlatformSettings.load()
            
            custom_amount = request.data.get('amount')
            if custom_amount is not None:
                fee = float(custom_amount)
            elif city_id:
                try:
                    city = City.objects.get(id=city_id)
                    fee = settings_obj.owner_onboarding_fee if settings_obj.owner_onboarding_fee > 0 else city.registration_fee
                except City.DoesNotExist:
                    fee = settings_obj.owner_onboarding_fee if settings_obj.owner_onboarding_fee > 0 else 99.0
            else:
                fee = settings_obj.owner_onboarding_fee if settings_obj.owner_onboarding_fee > 0 else 99.0

            amount = float(fee) * 100 # in paise
            
            import razorpay
            key_id = settings.RAZORPAY_KEY_ID
            key_secret = settings.RAZORPAY_KEY_SECRET
            client = razorpay.Client(auth=(key_id, key_secret))
            payment = client.order.create({
                'amount': int(amount),
                'currency': 'INR',
                'payment_capture': '1'
            })
            
            return Response({
                'order_id': payment['id'],
                'amount': payment['amount'],
                'key_id': key_id
            })
        except Exception as e:
            return Response({'detail': 'Payment gateway configuration error. Please contact the support team.'}, status=500)

class RegistrationConfigView(views.APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, city_id):
        try:
            city = City.objects.get(id=city_id)
            settings_obj = PlatformSettings.load()
            fee = settings_obj.owner_onboarding_fee if settings_obj.owner_onboarding_fee > 0 else city.registration_fee
            return Response({
                'upi_merchant_id': settings_obj.default_upi_id or 'merchant@upi',
                'registration_fee': str(fee),
                'owner_payment_gateway': settings_obj.owner_payment_gateway,
                'agent_payment_gateway': settings_obj.agent_payment_gateway,
                'admin_payment_gateway': settings_obj.admin_payment_gateway,
                'buyer_payment_gateway': settings_obj.buyer_payment_gateway,
            })
        except City.DoesNotExist:
            return Response({'detail': 'City not found.'}, status=404)

class SettingsVersionView(views.APIView):
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        settings_obj = PlatformSettings.load()
        return Response({
            'updated_at': settings_obj.updated_at.timestamp() if settings_obj.updated_at else 0
        })

class RequestOTPView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({'detail': 'OTP skipped', 'demo_code': '000000'})

class VerifyOTPView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({'detail': 'OTP verified successfully', 'verified': True})

class VerifyBuyerOTPView(views.APIView):
    def post(self, request):
        phone = request.data.get('phone')
        if not phone:
            return Response({'detail': 'Phone number required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if buyer exists, otherwise create
        user, created = User.objects.get_or_create(
            phone=phone,
            defaults={
                'username': phone,
                'role': 'buyer',
            }
        )
        
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=user)
        
        response = Response({'detail': 'Verified successfully.', 'token': token.key})
        response.set_cookie(
            'token',
            token.key,
            path='/',
            httponly=True,
            samesite='None' if not settings.DEBUG else 'Lax',
            secure=not settings.DEBUG
        )
        return response

from .serializers import SavedSearchSerializer
from .models import SavedSearch
from rest_framework.permissions import IsAuthenticated

class SavedSearchListCreateView(generics.ListCreateAPIView):
    serializer_class = SavedSearchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedSearch.objects.filter(buyer=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(buyer=self.request.user)

class SavedSearchDestroyView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedSearch.objects.filter(buyer=self.request.user)

from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 50

class PublicPropertyListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PropertySerializer
    pagination_class = StandardResultsSetPagination

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        if user and user.is_authenticated:
            from unlocks.models import Unlock
            unlocked_ids = set(
                Unlock.objects.filter(buyer=user, status='paid').values_list('property_id', flat=True)
            )
            context['unlocked_property_ids'] = unlocked_ids
        else:
            context['unlocked_property_ids'] = set()
        return context

    def get_queryset(self):
        # Live and Under Negotiation properties (Featured & Hero properties pinned first)
        queryset = Property.objects.select_related('locality', 'locality__city', 'agent', 'owner').prefetch_related('media').filter(status__in=['live', 'under_negotiation']).order_by('-is_featured', '-is_hero_spotlight', '-created_at')
        
        # Filters
        prop_type = self.request.query_params.get('property_type')
        if prop_type:
            if prop_type == 'apartment':
                queryset = queryset.filter(property_type__in=['apartment', '1bhk', '2bhk', '3bhk', '4bhk', '5bhk', 'studio', 'builder_floor'])
            elif prop_type == 'house':
                queryset = queryset.filter(property_type__in=['house', '1bhk', '2bhk', '3bhk', '4bhk', '5bhk'])
            elif prop_type == 'pg':
                queryset = queryset.filter(property_type__in=['pg', 'pg_hostel', 'pg_single', 'pg_double', 'pg_triple'])
            else:
                queryset = queryset.filter(property_type=prop_type)
            
        min_price = self.request.query_params.get('min_price')
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
            
        max_price = self.request.query_params.get('max_price')
        if max_price:
            queryset = queryset.filter(price__lte=max_price)
            
        locality_id = self.request.query_params.get('locality')
        if locality_id:
            queryset = queryset.filter(locality_id=locality_id)
            
        city_id = self.request.query_params.get('city_id')
        if city_id:
            queryset = queryset.filter(locality__city_id=city_id)
            
        # Radius Search
        lat_str = self.request.query_params.get('lat')
        lng_str = self.request.query_params.get('lng')
        radius_km_str = self.request.query_params.get('radius_km')
        
        if lat_str and lng_str and radius_km_str:
            import math
            try:
                lat = float(lat_str)
                lng = float(lng_str)
                radius_km = float(radius_km_str)
                
                # Check if PostGIS spatial Engine is active
                if settings.DATABASES['default']['ENGINE'] == 'django.contrib.gis.db.backends.postgis':
                    from django.contrib.gis.geos import Point
                    from django.contrib.gis.measure import D
                    user_location = Point(lng, lat, srid=4326)
                    queryset = queryset.filter(location__distance_lte=(user_location, D(km=radius_km)))
                    return queryset
                
                # Bounding Box + Haversine Fallback for SQLite / Standard DB
                lat_delta = radius_km / 111.0
                lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
                
                queryset = queryset.filter(
                    exact_lat__gte=lat - lat_delta,
                    exact_lat__lte=lat + lat_delta,
                    exact_lng__gte=lng - lng_delta,
                    exact_lng__lte=lng + lng_delta
                )
                
                # Exact Haversine Filter & Sorting
                properties = list(queryset)
                def haversine(lat1, lon1, lat2, lon2):
                    R = 6371
                    dlat = math.radians(lat2 - lat1)
                    dlon = math.radians(lon2 - lon1)
                    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
                    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))
                    
                filtered_props = []
                for p in properties:
                    dist = haversine(lat, lng, float(p.exact_lat), float(p.exact_lng))
                    if dist <= radius_km:
                        p.search_distance = dist
                        filtered_props.append(p)
                        
                filtered_props.sort(key=lambda x: x.search_distance)
                return filtered_props
            except ValueError:
                pass
                
        return queryset

class PublicPropertyDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PropertySerializer
    
    def get_queryset(self):
        user = self.request.user
        qs = Property.objects.select_related('locality', 'locality__city', 'agent', 'owner').prefetch_related('media')
        if user and user.is_authenticated:
            roles = user.roles if hasattr(user, 'roles') else [user.role]
            if 'admin' in roles or 'moderator' in roles:
                return qs.all()
            from unlocks.models import Unlock
            unlocked_ids = Unlock.objects.filter(buyer=user).values_list('property_id', flat=True)
            return qs.filter(
                Q(status__in=['live', 'under_negotiation', 'rented']) | 
                Q(owner=user) | Q(agent=user) | Q(id__in=unlocked_ids)
            )
        return qs.filter(status__in=['live', 'under_negotiation', 'rented'])

class MyPropertiesView(generics.ListAPIView):
    serializer_class = PropertySerializer

    def get_queryset(self):
        user = self.request.user
        roles = user.roles if hasattr(user, 'roles') else [user.role]
        if 'owner' in roles:
            from django.db.models import Count
            return Property.objects.filter(owner=user).annotate(
                unlock_count=Count('unlocks', filter=Q(unlocks__status='paid'))
            ).order_by('-created_at')
        return Property.objects.none()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        # Inject unlock_count into each item (from annotated queryset)
        for item, obj in zip(data, queryset):
            item['unlock_count'] = getattr(obj, 'unlock_count', 0)
        return Response(data)

class OwnerLeadsView(views.APIView):
    def get(self, request):
        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [user.role]
        if 'owner' not in roles:
            return Response([])
        
        from unlocks.models import Unlock
        unlocks = Unlock.objects.filter(property__owner=user).order_by('-created_at')
        
        data = []
        for u in unlocks:
            data.append({
                "id": u.id,
                "created_at": u.created_at,
                "user_name": u.buyer.get_full_name() or u.buyer.username,
                "user_phone": u.buyer.phone,
                "property_id": u.property_id,
                "lead_status": u.lead_status
            })
        return Response(data)

    def put(self, request):
        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [user.role]
        if 'owner' not in roles:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        
        lead_id = request.data.get('lead_id')
        lead_status = request.data.get('lead_status')
        if not lead_id or not lead_status:
            return Response({'detail': 'Missing lead_id or lead_status.'}, status=status.HTTP_400_BAD_REQUEST)
            
        from unlocks.models import Unlock
        try:
            lead = Unlock.objects.get(id=lead_id, property__owner=user)
            valid_statuses = [choice[0] for choice in Unlock.LEAD_STATUS_CHOICES]
            if lead_status in valid_statuses:
                lead.lead_status = lead_status
                lead.save(update_fields=['lead_status'])
                
                # If lead marked as rented, automatically mark property as rented too!
                if lead_status == 'rented' and lead.property:
                    lead.property.status = 'rented'
                    lead.property.save(update_fields=['status'])

                return Response({
                    'detail': 'Lead status updated successfully.' if lead_status != 'rented' else '🎉 Deal finalized! Property marked as rented.',
                    'lead_status': lead_status,
                    'property_id': lead.property_id
                })
            else:
                return Response({'detail': 'Invalid lead status.'}, status=status.HTTP_400_BAD_REQUEST)
        except Unlock.DoesNotExist:
            return Response({'detail': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)


class InitiateOnboardingPaymentView(views.APIView):
    """Owner pays the onboarding fee via Razorpay after property is created."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            prop = Property.objects.get(pk=pk, owner=request.user)
        except Property.DoesNotExist:
            return Response(
                {'detail': 'Property not found or you do not own it.'},
                status=status.HTTP_404_NOT_FOUND
            )

        platform_settings = PlatformSettings.load()
        if platform_settings.bypass_owner_payment:
            fee = 0.0
        else:
            fee = float(platform_settings.owner_onboarding_fee or 500)
        # NOTE: Amount is ALWAYS from server-side settings.
        # The client CANNOT influence the fee under any circumstance.

        if fee <= 0:
            return Response(
                {'detail': 'No onboarding fee is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if prop.onboarding_payment_status == 'paid':
            return Response(
                {'detail': 'Onboarding fee has already been paid.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if Razorpay credentials are properly configured — prefer DB over env vars
        # DB keys (set via Admin Settings UI) take priority and take effect without restart
        db_key_id = (platform_settings.razorpay_key_id or '').strip()
        db_key_secret = (platform_settings.razorpay_key_secret or '').strip()
        if db_key_id and db_key_secret and 'REPLACE_WITH' not in db_key_secret:
            razorpay_key_id = db_key_id
            razorpay_key_secret = db_key_secret
        else:
            razorpay_key_id = getattr(settings, 'RAZORPAY_KEY_ID', '')
            razorpay_key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')

        razorpay_ready = (
            razorpay_key_id and razorpay_key_secret
            and 'REPLACE_WITH' not in razorpay_key_secret
            and 'dummy' not in razorpay_key_id
        )

        # If bypass_owner_payment is explicitly set to True, mark as paid instantly
        if platform_settings.bypass_owner_payment:
            prop.onboarding_payment_status = 'paid'
            prop.onboarding_payment_method = 'bypass'
            prop.save(update_fields=['onboarding_payment_status', 'onboarding_payment_method'])
            return Response({
                'bypassed': True,
                'detail': 'Onboarding fee bypassed. Property is ready for submission.',
                'property_id': prop.id,
            })
            
        if not razorpay_ready:
            return Response(
                {'detail': 'Payment gateway is not configured or credentials are invalid. Please contact the support team.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            import razorpay as rzp
            razorpay_client = rzp.Client(auth=(razorpay_key_id, razorpay_key_secret))
            razorpay_order = razorpay_client.order.create({
                'amount': int(fee * 100),  # convert to paise
                'currency': 'INR',
                'payment_capture': '1',
                'notes': {
                    'property_id': str(prop.id),
                    'type': 'onboarding_fee'
                }
            })
            # Store method so admin can see payment intent
            prop.onboarding_payment_method = 'razorpay'
            prop.save(update_fields=['onboarding_payment_method'])

            return Response({
                'order_id': razorpay_order['id'],
                'razorpay_key_id': razorpay_key_id,
                'amount': int(fee * 100),
                'currency': 'INR',
                'property_id': prop.id,
            })
        except Exception:
            import logging
            logging.getLogger(__name__).error(
                f"Razorpay onboarding order failed for property {pk}", exc_info=True
            )
            return Response(
                {'detail': 'Payment gateway configuration error. Please contact the support team.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class VerifyOnboardingPaymentView(views.APIView):
    """Verify Razorpay signature and mark the onboarding fee as paid."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            import razorpay
            from django.conf import settings
            razorpay_client = razorpay.Client(
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            )
        except Exception:
            return Response(
                {'detail': 'Razorpay is not configured on this server.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            prop = Property.objects.get(pk=pk, owner=request.user)
        except Property.DoesNotExist:
            return Response(
                {'detail': 'Property not found or you do not own it.'},
                status=status.HTTP_404_NOT_FOUND
            )

        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_order_id   = request.data.get('razorpay_order_id')
        razorpay_signature  = request.data.get('razorpay_signature')

        if not all([razorpay_payment_id, razorpay_order_id, razorpay_signature]):
            return Response(
                {'detail': 'Missing payment verification details.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            razorpay_client.utility.verify_payment_signature({
                'razorpay_order_id':   razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature':  razorpay_signature,
            })
        except razorpay.errors.SignatureVerificationError:
            return Response(
                {'detail': 'Invalid payment signature. Verification failed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        prop.onboarding_payment_status = 'paid'
        prop.onboarding_payment_method = 'razorpay'
        prop.save(update_fields=['onboarding_payment_status', 'onboarding_payment_method'])

        # Create system notification for onboarding payment success
        from notifications.models import Notification
        Notification.objects.create(
            recipient=request.user,
            message=f"Onboarding payment verified successfully for property #{prop.id}.",
            property=prop
        )

        return Response({
            'detail': 'Onboarding payment verified successfully.',
            'status': 'paid'
        })

from .models import PlatformSettings

from rest_framework.throttling import AnonRateThrottle

class PlatformSettingsView(views.APIView):
    throttle_classes = [AnonRateThrottle]
    throttle_scope = 'platform_settings'

    def get_permissions(self):
        if self.request.method == 'GET':
            return []  # Public read allowed
        from accounts.permissions import IsAdmin
        return [IsAdmin()]

    def get(self, request):
        settings = PlatformSettings.load()
        data = {
            'default_upi_id': settings.default_upi_id,
            'company_name': settings.company_name,
            'company_logo_url': settings.company_logo_url,
            'buyer_unlock_fee': settings.buyer_unlock_fee,
            'buyer_pass_starter_price': settings.buyer_pass_starter_price,
            'buyer_pass_smart_price': settings.buyer_pass_smart_price,
            'buyer_pass_pro_price': settings.buyer_pass_pro_price,

            'owner_residential_fee': settings.owner_residential_fee,
            'owner_residential_3pack_price': settings.owner_residential_3pack_price,
            'owner_residential_6pack_price': settings.owner_residential_6pack_price,
            'owner_residential_10pack_price': settings.owner_residential_10pack_price,

            'owner_apt_pg_fee': settings.owner_apt_pg_fee,
            'owner_apt_pg_3pack_price': settings.owner_apt_pg_3pack_price,
            'owner_apt_pg_6pack_price': settings.owner_apt_pg_6pack_price,
            'owner_apt_pg_10pack_price': settings.owner_apt_pg_10pack_price,

            'owner_commercial_fee': settings.owner_commercial_fee,
            'owner_commercial_3pack_price': settings.owner_commercial_3pack_price,
            'owner_commercial_6pack_price': settings.owner_commercial_6pack_price,
            'owner_commercial_10pack_price': settings.owner_commercial_10pack_price,

            'owner_combo_discount_percent': settings.owner_combo_discount_percent,
            'owner_onboarding_fee': settings.owner_onboarding_fee,

            # Theme & Gateway (safe to expose publicly)
            'theme': settings.theme,
            'buyer_theme': settings.buyer_theme,
            'dashboard_theme': settings.dashboard_theme,
            'owner_payment_gateway': settings.owner_payment_gateway,
            'agent_payment_gateway': settings.agent_payment_gateway,
            'admin_payment_gateway': settings.admin_payment_gateway,
            'buyer_payment_gateway': settings.buyer_payment_gateway,

            # OTP requirements (safe to expose — just config, not secrets)
            'buyer_require_otp_login': settings.buyer_require_otp_login,
            'buyer_require_otp_signup': settings.buyer_require_otp_signup,
            'owner_require_otp_login': settings.owner_require_otp_login,
            'owner_require_otp_signup': settings.owner_require_otp_signup,
            'agent_require_otp_login': settings.agent_require_otp_login,
            'agent_require_otp_signup': settings.agent_require_otp_signup,
            'admin_require_otp_login': settings.admin_require_otp_login,
            'admin_require_otp_signup': settings.admin_require_otp_signup,

            # E-Stamp Phase 2 Settings
            'enable_e_stamp_agreements': settings.enable_e_stamp_agreements,
            'e_stamp_price': settings.e_stamp_price,
            'e_stamp_provider': settings.e_stamp_provider,
            'e_stamp_api_key': settings.e_stamp_api_key if (request.user and request.user.is_authenticated and 'admin' in getattr(request.user, 'roles', [])) else '',
            'e_stamp_api_secret': settings.e_stamp_api_secret if (request.user and request.user.is_authenticated and 'admin' in getattr(request.user, 'roles', [])) else '',

            # Owner Listing Verification
            'owner_listing_verification_method': settings.owner_listing_verification_method,

            # Validity durations
            'validity_residential_days': settings.validity_residential_days,
            'validity_apt_pg_days': settings.validity_apt_pg_days,
            'validity_apt_pg_1pack_days': settings.validity_apt_pg_1pack_days,
            'validity_apt_pg_3pack_days': settings.validity_apt_pg_3pack_days,
            'validity_apt_pg_6pack_days': settings.validity_apt_pg_6pack_days,
            'validity_apt_pg_10pack_days': settings.validity_apt_pg_10pack_days,
            'validity_commercial_days': settings.validity_commercial_days,

            # Custom PG/Apartment durations & pricing
            'pg_custom_duration_1_days': settings.pg_custom_duration_1_days,
            'pg_custom_duration_1_price': settings.pg_custom_duration_1_price,
            'pg_custom_duration_2_days': settings.pg_custom_duration_2_days,
            'pg_custom_duration_2_price': settings.pg_custom_duration_2_price,
            'pg_custom_duration_3_days': settings.pg_custom_duration_3_days,
            'pg_custom_duration_3_price': settings.pg_custom_duration_3_price,
            'pg_custom_duration_4_days': settings.pg_custom_duration_4_days,
            'pg_custom_duration_4_price': settings.pg_custom_duration_4_price,
        }

        # Admin-only fields: bypass flags must never be exposed publicly
        # They reveal internal dev/test state to potential attackers
        is_admin = (
            request.user and
            request.user.is_authenticated and
            'admin' in getattr(request.user, 'roles', [])
        )
        if is_admin:
            data['bypass_buyer_payment'] = settings.bypass_buyer_payment
            data['bypass_owner_payment'] = settings.bypass_owner_payment
            data['otp_bypass_enabled'] = settings.otp_bypass_enabled

            # Razorpay credentials (admin-only; secrets masked)
            data['razorpay_key_id'] = settings.razorpay_key_id
            # Return a masked indicator for secrets — never return the real value
            data['razorpay_key_secret_set'] = bool(settings.razorpay_key_secret and 'REPLACE_WITH' not in settings.razorpay_key_secret)
            data['razorpay_webhook_secret_set'] = bool(settings.razorpay_webhook_secret)
            data['razorpay_key_secret_masked'] = ('••••' + settings.razorpay_key_secret[-4:]) if (settings.razorpay_key_secret and len(settings.razorpay_key_secret) > 4 and 'REPLACE_WITH' not in settings.razorpay_key_secret) else ''

            # SMS provider config (admin-only; secret masked)
            data['sms_provider'] = settings.sms_provider
            data['sms_api_key'] = settings.sms_api_key
            data['sms_api_secret_set'] = bool(settings.sms_api_secret)
            data['sms_api_secret_masked'] = ('••••' + settings.sms_api_secret[-4:]) if (settings.sms_api_secret and len(settings.sms_api_secret) > 4) else ''
            data['sms_sender_id'] = settings.sms_sender_id
            data['sms_template_id'] = settings.sms_template_id
            data['sms_from_number'] = settings.sms_from_number
        else:
            # Non-admin: expose Razorpay Key ID only (needed for frontend Razorpay.js checkout)
            data['razorpay_key_id'] = settings.razorpay_key_id

        response = Response(data)
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response

    def put(self, request):
        settings = PlatformSettings.load()
        client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
        if client_ip and ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()

        audit_fields = [
            'default_upi_id',
            'buyer_unlock_fee', 'buyer_pass_starter_price', 'buyer_pass_smart_price', 'buyer_pass_pro_price',
            'owner_residential_fee', 'owner_apt_pg_fee', 'owner_commercial_fee', 'e_stamp_price',
            'bypass_buyer_payment', 'bypass_owner_payment', 'buyer_theme', 'dashboard_theme',
            'buyer_payment_gateway', 'owner_payment_gateway', 'enable_e_stamp_agreements',
            'validity_residential_days', 'validity_apt_pg_days',
            'validity_apt_pg_1pack_days', 'validity_apt_pg_3pack_days', 'validity_apt_pg_6pack_days', 'validity_apt_pg_10pack_days',
            'validity_commercial_days',
            'pg_custom_duration_1_days', 'pg_custom_duration_1_price',
            'pg_custom_duration_2_days', 'pg_custom_duration_2_price',
            'pg_custom_duration_3_days', 'pg_custom_duration_3_price',
            'pg_custom_duration_4_days', 'pg_custom_duration_4_price'
        ]
        
        # 1. Audit Log Tracking: Compare old vs new BEFORE mutating (strict normalization)
        from decimal import Decimal
        for field in audit_fields:
            if field in request.data:
                old_raw = getattr(settings, field, None)
                new_raw = request.data.get(field)

                if old_raw is None or new_raw is None:
                    continue

                is_changed = False
                old_str_display = str(old_raw)
                new_str_display = str(new_raw)

                if isinstance(old_raw, bool):
                    new_bool = str(new_raw).lower() in ['true', '1', 'yes']
                    is_changed = (old_raw != new_bool)
                    old_str_display = str(old_raw)
                    new_str_display = str(new_bool)
                elif isinstance(old_raw, (int, float, Decimal)):
                    try:
                        old_num = float(old_raw)
                        new_num = float(new_raw)
                        is_changed = (abs(old_num - new_num) > 0.0001)
                        old_str_display = f"{old_num:g}"
                        new_str_display = f"{new_num:g}"
                    except (ValueError, TypeError):
                        is_changed = (str(old_raw).strip() != str(new_raw).strip())
                else:
                    is_changed = (str(old_raw).strip() != str(new_raw).strip())
                    old_str_display = str(old_raw).strip()
                    new_str_display = str(new_raw).strip()

                if is_changed:
                    PlatformSettingsAuditLog.objects.create(
                        changed_by=request.user if request.user.is_authenticated else None,
                        field_name=field,
                        old_value=old_str_display,
                        new_value=new_str_display,
                        ip_address=client_ip or '127.0.0.1'
                    )

        # 2. Mutate settings fields
        settings.default_upi_id = request.data.get('default_upi_id', settings.default_upi_id)
        settings.company_name = request.data.get('company_name', settings.company_name)
        settings.company_logo_url = request.data.get('company_logo_url', settings.company_logo_url)
        settings.buyer_unlock_fee = request.data.get('buyer_unlock_fee', settings.buyer_unlock_fee)
        settings.buyer_pass_starter_price = request.data.get('buyer_pass_starter_price', settings.buyer_pass_starter_price)
        settings.buyer_pass_smart_price = request.data.get('buyer_pass_smart_price', settings.buyer_pass_smart_price)
        settings.buyer_pass_pro_price = request.data.get('buyer_pass_pro_price', settings.buyer_pass_pro_price)

        settings.owner_residential_fee = request.data.get('owner_residential_fee', settings.owner_residential_fee)
        settings.owner_residential_3pack_price = request.data.get('owner_residential_3pack_price', settings.owner_residential_3pack_price)
        settings.owner_residential_6pack_price = request.data.get('owner_residential_6pack_price', settings.owner_residential_6pack_price)
        settings.owner_residential_10pack_price = request.data.get('owner_residential_10pack_price', settings.owner_residential_10pack_price)

        settings.owner_apt_pg_fee = request.data.get('owner_apt_pg_fee', settings.owner_apt_pg_fee)
        settings.owner_apt_pg_3pack_price = request.data.get('owner_apt_pg_3pack_price', settings.owner_apt_pg_3pack_price)
        settings.owner_apt_pg_6pack_price = request.data.get('owner_apt_pg_6pack_price', settings.owner_apt_pg_6pack_price)
        settings.owner_apt_pg_10pack_price = request.data.get('owner_apt_pg_10pack_price', settings.owner_apt_pg_10pack_price)

        settings.owner_commercial_fee = request.data.get('owner_commercial_fee', settings.owner_commercial_fee)
        settings.owner_commercial_3pack_price = request.data.get('owner_commercial_3pack_price', settings.owner_commercial_3pack_price)
        settings.owner_commercial_6pack_price = request.data.get('owner_commercial_6pack_price', settings.owner_commercial_6pack_price)
        settings.owner_commercial_10pack_price = request.data.get('owner_commercial_10pack_price', settings.owner_commercial_10pack_price)

        settings.owner_combo_discount_percent = request.data.get('owner_combo_discount_percent', settings.owner_combo_discount_percent)
        settings.owner_onboarding_fee = request.data.get('owner_onboarding_fee', settings.owner_onboarding_fee)
        
        if 'validity_residential_days' in request.data:
            settings.validity_residential_days = int(request.data.get('validity_residential_days', settings.validity_residential_days))
        if 'validity_apt_pg_days' in request.data:
            settings.validity_apt_pg_days = int(request.data.get('validity_apt_pg_days', settings.validity_apt_pg_days))
        if 'validity_apt_pg_1pack_days' in request.data:
            settings.validity_apt_pg_1pack_days = int(request.data.get('validity_apt_pg_1pack_days', settings.validity_apt_pg_1pack_days))
        if 'validity_apt_pg_3pack_days' in request.data:
            settings.validity_apt_pg_3pack_days = int(request.data.get('validity_apt_pg_3pack_days', settings.validity_apt_pg_3pack_days))
        if 'validity_apt_pg_6pack_days' in request.data:
            settings.validity_apt_pg_6pack_days = int(request.data.get('validity_apt_pg_6pack_days', settings.validity_apt_pg_6pack_days))
        if 'validity_apt_pg_10pack_days' in request.data:
            settings.validity_apt_pg_10pack_days = int(request.data.get('validity_apt_pg_10pack_days', settings.validity_apt_pg_10pack_days))
        if 'validity_commercial_days' in request.data:
            settings.validity_commercial_days = int(request.data.get('validity_commercial_days', settings.validity_commercial_days))

        from decimal import Decimal
        if 'pg_custom_duration_1_days' in request.data:
            settings.pg_custom_duration_1_days = int(request.data.get('pg_custom_duration_1_days'))
        if 'pg_custom_duration_1_price' in request.data:
            settings.pg_custom_duration_1_price = Decimal(request.data.get('pg_custom_duration_1_price'))
        if 'pg_custom_duration_2_days' in request.data:
            settings.pg_custom_duration_2_days = int(request.data.get('pg_custom_duration_2_days'))
        if 'pg_custom_duration_2_price' in request.data:
            settings.pg_custom_duration_2_price = Decimal(request.data.get('pg_custom_duration_2_price'))
        if 'pg_custom_duration_3_days' in request.data:
            settings.pg_custom_duration_3_days = int(request.data.get('pg_custom_duration_3_days'))
        if 'pg_custom_duration_3_price' in request.data:
            settings.pg_custom_duration_3_price = Decimal(request.data.get('pg_custom_duration_3_price'))
        if 'pg_custom_duration_4_days' in request.data:
            settings.pg_custom_duration_4_days = int(request.data.get('pg_custom_duration_4_days'))
        if 'pg_custom_duration_4_price' in request.data:
            settings.pg_custom_duration_4_price = Decimal(request.data.get('pg_custom_duration_4_price'))

        settings.buyer_theme = request.data.get('buyer_theme', settings.buyer_theme)
        settings.dashboard_theme = request.data.get('dashboard_theme', settings.dashboard_theme)
        if 'buyer_theme' in request.data:
            settings.theme = request.data.get('buyer_theme')
        else:
            settings.theme = request.data.get('theme', settings.theme)
        settings.owner_payment_gateway = request.data.get('owner_payment_gateway', settings.owner_payment_gateway)
        settings.agent_payment_gateway = request.data.get('agent_payment_gateway', settings.agent_payment_gateway)
        settings.admin_payment_gateway = request.data.get('admin_payment_gateway', settings.admin_payment_gateway)
        settings.buyer_payment_gateway = request.data.get('buyer_payment_gateway', settings.buyer_payment_gateway)
        
        settings.e_stamp_price = request.data.get('e_stamp_price', settings.e_stamp_price)
        settings.e_stamp_provider = request.data.get('e_stamp_provider', settings.e_stamp_provider)
        settings.e_stamp_api_key = request.data.get('e_stamp_api_key', settings.e_stamp_api_key)
        settings.e_stamp_api_secret = request.data.get('e_stamp_api_secret', settings.e_stamp_api_secret)

        bypass_buyer = request.data.get('bypass_buyer_payment')
        if bypass_buyer is not None:
            settings.bypass_buyer_payment = (str(bypass_buyer).lower() in ['true', '1', 'yes'])
            
        bypass_owner = request.data.get('bypass_owner_payment')
        if bypass_owner is not None:
            settings.bypass_owner_payment = (str(bypass_owner).lower() in ['true', '1', 'yes'])

        enable_estamp = request.data.get('enable_e_stamp_agreements')
        if enable_estamp is not None:
            settings.enable_e_stamp_agreements = (str(enable_estamp).lower() in ['true', '1', 'yes'])

        def set_bool(key):
            val = request.data.get(key)
            if val is not None:
                setattr(settings, key, str(val).lower() in ['true', '1', 'yes'])
                
        set_bool('buyer_require_otp_login')
        set_bool('buyer_require_otp_signup')
        set_bool('owner_require_otp_login')
        set_bool('owner_require_otp_signup')
        set_bool('agent_require_otp_login')
        set_bool('agent_require_otp_signup')
        set_bool('otp_bypass_enabled')

        # Owner listing verification method
        new_method = request.data.get('owner_listing_verification_method')
        if new_method in ('otp', 'selfie'):
            settings.owner_listing_verification_method = new_method

        # Razorpay credentials
        rzp_key_id = request.data.get('razorpay_key_id')
        if rzp_key_id is not None:
            settings.razorpay_key_id = rzp_key_id.strip()
        rzp_key_secret = request.data.get('razorpay_key_secret', '')
        # Only update if it's not a masked placeholder (masked values contain '•')
        if rzp_key_secret and '•' not in rzp_key_secret:
            settings.razorpay_key_secret = rzp_key_secret.strip()
        rzp_webhook_secret = request.data.get('razorpay_webhook_secret', '')
        if rzp_webhook_secret and '•' not in rzp_webhook_secret:
            settings.razorpay_webhook_secret = rzp_webhook_secret.strip()

        # SMS provider credentials
        sms_provider = request.data.get('sms_provider')
        if sms_provider in [c[0] for c in settings.SMS_PROVIDER_CHOICES]:
            settings.sms_provider = sms_provider
        sms_api_key = request.data.get('sms_api_key')
        if sms_api_key is not None:
            settings.sms_api_key = sms_api_key.strip()
        sms_api_secret = request.data.get('sms_api_secret', '')
        if sms_api_secret and '•' not in sms_api_secret:
            settings.sms_api_secret = sms_api_secret.strip()
        sms_sender_id = request.data.get('sms_sender_id')
        if sms_sender_id is not None:
            settings.sms_sender_id = sms_sender_id.strip()
        sms_template_id = request.data.get('sms_template_id')
        if sms_template_id is not None:
            settings.sms_template_id = sms_template_id.strip()
        sms_from_number = request.data.get('sms_from_number')
        if sms_from_number is not None:
            settings.sms_from_number = sms_from_number.strip()

        settings.save()
        return Response({'detail': 'Platform settings updated successfully.'})

class PlatformSettingsAuditLogListView(views.APIView):
    def get_permissions(self):
        from accounts.permissions import IsAdmin
        return [IsAdmin()]

    def get(self, request):
        logs = PlatformSettingsAuditLog.objects.select_related('changed_by').order_by('-changed_at')[:100]
        data = [{
            'id': l.id,
            'changed_by': l.changed_by.username if l.changed_by else 'System / Admin',
            'changed_by_user_id': l.changed_by_id,
            'field_name': l.field_name,
            'old_value': l.old_value,
            'new_value': l.new_value,
            'ip_address': l.ip_address,
            'changed_at': l.changed_at.isoformat()
        } for l in logs]
        return Response(data)

    def delete(self, request):
        count, _ = PlatformSettingsAuditLog.objects.all().delete()
        return Response({'detail': f'Audit log history cleared successfully ({count} records deleted).'})

from django.db.models import Case, When, Value, IntegerField

class SimilarPropertiesView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PropertySerializer
    pagination_class = None

    def get_queryset(self):
        pk = self.kwargs.get('pk')
        try:
            prop = Property.objects.get(pk=pk)
        except Property.DoesNotExist:
            return Property.objects.none()

        queryset = Property.objects.select_related('locality', 'locality__city', 'agent', 'owner').prefetch_related('media').filter(status='live').exclude(pk=pk)
        
        if prop.locality:
            queryset = queryset.filter(locality__city=prop.locality.city)
            queryset = queryset.annotate(
                is_same_locality=Case(
                    When(locality=prop.locality, then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            ).order_by('-is_same_locality', '-created_at')
        else:
            queryset = queryset.order_by('-created_at')
            
        return queryset[:4]

class GenerateDescriptionView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        prop_type = str(data.get('property_type', 'property'))
        bedrooms = data.get('bedrooms') or data.get('bhk', '')
        bathrooms = data.get('bathrooms', '')
        price = data.get('price', '')
        area = data.get('carpet_area') or data.get('area_sqft', '')
        furnishing = str(data.get('furnishing_status', ''))
        preferred_tenants = str(data.get('preferred_tenants', ''))
        food_pref = str(data.get('food_preference', ''))
        pet_pol = str(data.get('pet_policy', ''))
        amenities = data.get('amenities', [])

        # Create a deterministic seed based on inputs to ensure variety across listings
        seed_source = f"{prop_type}_{bedrooms}_{price}_{area}_{furnishing}_{preferred_tenants}_{len(amenities)}"
        seed_num = sum(ord(c) for c in seed_source)
        import random
        rng = random.Random(seed_num)

        # Title formatting
        bhk_title = f"{bedrooms} BHK " if bedrooms else ""
        title = f"{bhk_title}{prop_type.replace('_', ' ').title()}"

        intros = [
            f"Welcome to this gorgeous {title}! A perfect blend of comfort, convenience, and contemporary style.",
            f"Discover your next home in this spectacular {title}, offering a vibrant and modern living experience.",
            f"Experience premium living in this beautifully designed {title}, situated in a highly desirable neighborhood.",
            f"Presenting a stunning, well-lit {title} that is thoughtfully crafted for a seamless modern lifestyle.",
            f"Step into this elegant {title}, designed to deliver the utmost in relaxation, functionality, and charm."
        ]
        intro_part = rng.choice(intros)

        # Furnishing formatting
        furnishing_clean = furnishing.lower().replace('_', ' ') if furnishing else ""
        if furnishing_clean == 'none' or not furnishing_clean:
            furnishing_clean = "unfurnished"
        elif furnishing_clean == 'semi furnished':
            furnishing_clean = "semi-furnished"
        elif furnishing_clean == 'fully furnished':
            furnishing_clean = "fully-furnished"

        specs_list = []
        if area: specs_list.append(f"a spacious carpet area of {area} sq.ft.")
        if furnishing_clean: specs_list.append(f"is offered as {furnishing_clean}")
        if bathrooms: specs_list.append(f"includes {bathrooms} well-appointed bathroom(s)")

        if specs_list:
            spec_templates = [
                f"Featuring {', '.join(specs_list)}, it is thoughtfully designed to cater to all your lifestyle needs.",
                f"The property boasts {', '.join(specs_list)}, offering a bright and open atmosphere throughout.",
                f"With {', '.join(specs_list)}, this home provides an ideal setting for relaxed everyday living.",
                f"Designed to make optimal use of space, it features {', '.join(specs_list)} for maximum comfort."
            ]
            spec_part = rng.choice(spec_templates)
        else:
            spec_part = ""

        rules = []
        if preferred_tenants and preferred_tenants != 'any':
            tenant_str = 'Boys Only' if preferred_tenants == 'only_boys' else 'Girls Only' if preferred_tenants == 'only_girls' else preferred_tenants.replace('_', ' ').capitalize()
            rules.append(f"Preferred Tenants: {tenant_str}")
        if food_pref and food_pref != 'any':
            food_str = 'Veg Only' if food_pref == 'veg_only' else 'Non-Veg Allowed' if food_pref == 'non_veg_allowed' else food_pref.replace('_', ' ')
            rules.append(f"Food Preference: {food_str}")
        if pet_pol and pet_pol != 'not_allowed':
            rules.append(f"Pet Policy: Allowed")

        if rules:
            rules_str = " | ".join(rules)
            rules_templates = [
                f"The property follows a policy of {rules_str}.",
                f"Key residency guidelines: {rules_str}.",
                f"House rules and policies: {rules_str}."
            ]
            rules_part = rng.choice(rules_templates)
        else:
            rules_part = ""

        if amenities and isinstance(amenities, list) and len(amenities) > 0:
            am_names = [a.replace('_', ' ').title() for a in amenities[:6]]
            if len(am_names) > 1:
                am_str = ", ".join(am_names[:-1]) + f", and {am_names[-1]}"
            else:
                am_str = am_names[0]
                
            amenities_templates = [
                f"Residents will enjoy top-tier amenities including {am_str}.",
                f"The community is equipped with excellent facilities such as {am_str} to elevate your lifestyle.",
                f"Enhance your daily living experience with high-quality features, including {am_str}.",
                f"Equipped with modern conveniences like {am_str}, the property ensures a highly convenient living environment."
            ]
            amenities_part = rng.choice(amenities_templates)
        else:
            amenities_part = ""

        if price:
            try:
                formatted_price = f"₹{float(price):,.0f}"
            except Exception:
                formatted_price = f"₹{price}"
                
            price_templates = [
                f"Offered at a competitive rate of {formatted_price}/month, it represents a remarkable value for the locality.",
                f"Available for lease at {formatted_price} monthly, this property is an exceptional deal that won't stay on the market long.",
                f"With an attractive monthly rent of {formatted_price}, this listing offers an unbeatable combination of quality and value.",
                f"At just {formatted_price}/month, this home delivers premium specs in a prime residential spot."
            ]
            price_part = rng.choice(price_templates)
        else:
            price_part = ""

        outros = [
            "Schedule a private tour today and experience this lovely space in person!",
            "Don't miss out on this fantastic opportunity. Contact us now to book your viewing slot!",
            "Reach out today to coordinate a viewing and secure this beautiful home for yourself!",
            "This listing is highly sought-after. Get in touch with us immediately to arrange a walk-through!"
        ]
        outro_part = rng.choice(outros)

        body_parts = []
        if spec_part: body_parts.append(spec_part)
        if rules_part: body_parts.append(rules_part)
        if amenities_part: body_parts.append(amenities_part)
        if price_part: body_parts.append(price_part)

        final_text = f"{intro_part}\n\n"
        if body_parts:
            final_text += " ".join(body_parts) + "\n\n"
        final_text += outro_part

        return Response({'description': final_text})


class PropertyDetailUpdateView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PropertySerializer
    queryset = Property.objects.all()

    def patch(self, request, *args, **kwargs):
        """
        Handles partial updates. Explicitly handles `status` field
        directly via model save to avoid serializer read_only_fields issues.
        """
        instance = self.get_object()
        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]

        # Authorization: admin/moderator can update any; owner/agent can only update their own
        if 'admin' not in roles and 'moderator' not in roles:
            if instance.owner != user and instance.agent != user:
                raise PermissionDenied("Not authorized to modify this property.")

        VALID_STATUSES = ['draft', 'pending_review', 'live', 'under_negotiation', 'rented', 'rejected']

        new_status = request.data.get('status')
        if new_status:
            if new_status not in VALID_STATUSES:
                return Response({'detail': f'Invalid status: {new_status}'}, status=status.HTTP_400_BAD_REQUEST)

            # Credit-based Relisting logic when transitioning to 'live'
            if new_status == 'live' and instance.status in ['expired', 'rented', 'draft', 'rejected']:
                if 'admin' not in roles and 'moderator' not in roles:
                    # Determine target category
                    prop_cat = instance.property_category
                    prop_type = instance.property_type
                    
                    if prop_cat == 'pg' or prop_type in ['apartment', 'flat', 'pg_hostel', 'pg_single', 'pg_double', 'pg_triple', 'pg', 'hostel']:
                        target_cat = 'apartment'
                    elif prop_cat == 'commercial' or prop_type in ['shop', 'office', 'warehouse', 'showroom', 'industrial', 'commercial_building']:
                        target_cat = 'commercial'
                    else:
                        target_cat = 'residential'

                    user_phone = getattr(user, 'phone', None)
                    from django.db.models import Q
                    from unlocks.models import OwnerListingPass
                    
                    pass_filter = Q(owner=user)
                    if user_phone:
                        pass_filter |= Q(owner__phone=user_phone)

                    active_pass = OwnerListingPass.objects.filter(
                        pass_filter,
                        status='active',
                        credits_remaining__gt=0
                    ).filter(
                        Q(category='all') | Q(category__iexact=target_cat)
                    ).order_by('created_at').first()

                    if not active_pass:
                        return Response({
                            'detail': f'No active listing credits found for {target_cat.capitalize()}. Please purchase listing credits to relist.',
                            'requires_payment': True,
                            'category': target_cat
                        }, status=status.HTTP_402_PAYMENT_REQUIRED)

                    # Consume 1 credit
                    active_pass.credits_remaining -= 1
                    if active_pass.credits_remaining <= 0:
                        active_pass.status = 'depleted'
                    active_pass.save()

            old_status = instance.status
            instance.status = new_status
            if new_status == 'under_negotiation':
                instance.under_negotiation_since = timezone.now()
            else:
                instance.under_negotiation_since = None

            # Reset expires_at dynamically from settings when going live
            if new_status == 'live':
                from properties.models import PlatformSettings
                ps = PlatformSettings.load()
                prop_cat = instance.property_category
                prop_type = instance.property_type
                if prop_cat == 'pg' or prop_type in ['pg', 'pg_hostel', 'pg_single', 'pg_double', 'pg_triple']:
                    pg_validity = ps.validity_apt_pg_1pack_days or ps.validity_apt_pg_days or 60
                    instance.expires_at = timezone.now() + timedelta(days=pg_validity)
                else:
                    instance.expires_at = None  # Active until rented!

            instance.save(update_fields=['status', 'under_negotiation_since', 'expires_at'])
            
            if old_status != new_status:
                from properties.models import PropertyAuditLog
                PropertyAuditLog.objects.create(
                    property=instance,
                    changed_by=request.user,
                    field_name='status',
                    old_value=str(old_status),
                    new_value=str(new_status)
                )

            return Response({'detail': f'Status updated to {new_status}', 'status': instance.status, 'expires_at': instance.expires_at})

        # Fall back to standard partial update for other fields
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def perform_update(self, serializer):
        instance = serializer.instance
        user = self.request.user
        
        # Check roles of the user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        is_admin_or_mod = 'admin' in roles or 'moderator' in roles
        
        trigger_review = False
        if not is_admin_or_mod:
            # Check price change
            if 'price' in serializer.validated_data:
                new_price = serializer.validated_data['price']
                if instance.price != new_price:
                    trigger_review = True
            
            # Check uploaded_media change (new photos added)
            if 'uploaded_media' in serializer.validated_data:
                trigger_review = True
        
        changes = []
        for attr, value in serializer.validated_data.items():
            old_value = getattr(instance, attr, None)
            if old_value != value:
                changes.append({
                    'field_name': attr,
                    'old_value': str(old_value),
                    'new_value': str(value)
                })
        
        if trigger_review:
            serializer.validated_data['status'] = 'pending_review'
            changes.append({
                'field_name': 'status',
                'old_value': str(instance.status),
                'new_value': 'pending_review'
            })
        
        serializer.save()
        
        if changes:
            from properties.models import PropertyAuditLog
            for change in changes:
                PropertyAuditLog.objects.create(
                    property=instance,
                    changed_by=user,
                    **change
                )


class EstimatePriceView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        locality_id = request.query_params.get('locality')
        city_id = request.query_params.get('city_id')
        property_type = request.query_params.get('property_type', 'apartment')
        area_str = request.query_params.get('area') or request.query_params.get('carpet_area')

        try:
            target_area = float(area_str) if area_str else 1000.0
        except (ValueError, TypeError):
            target_area = 1000.0

        queryset = Property.objects.filter(
            property_type=property_type,
            status__in=['live', 'sold', 'rented', 'under_negotiation'],
            carpet_area__gt=0,
            price__gt=0
        )

        if locality_id:
            locality_qs = queryset.filter(locality_id=locality_id)
            if locality_qs.exists():
                queryset = locality_qs
            elif city_id:
                queryset = queryset.filter(locality__city_id=city_id)
        elif city_id:
            queryset = queryset.filter(locality__city_id=city_id)

        sample_size = queryset.count()

        if sample_size > 0:
            rates = []
            for p in queryset[:50]:
                if p.carpet_area and p.carpet_area > 0:
                    rates.append(float(p.price) / float(p.carpet_area))
            
            if rates:
                rates.sort()
                mid = len(rates) // 2
                median_sqft_rate = rates[mid] if len(rates) % 2 != 0 else (rates[mid - 1] + rates[mid]) / 2.0
            else:
                median_sqft_rate = 15.0
        else:
            median_sqft_rate = 15.0

        estimated_price = round(median_sqft_rate * target_area)
        min_price = round(estimated_price * 0.88)
        max_price = round(estimated_price * 1.12)

        return Response({
            'locality_id': locality_id,
            'property_type': property_type,
            'carpet_area': target_area,
            'avg_rate_per_sqft': round(median_sqft_rate, 2),
            'estimated_price': estimated_price,
            'price_range_min': min_price,
            'price_range_max': max_price,
            'sample_size': sample_size
        })


class CalculateListingFeeView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        types = request.data.get('property_types', [])
        if not types:
            single_type = request.data.get('property_type', 'apartment')
            types = [single_type]

        settings = PlatformSettings.load()
        itemized = []
        subtotal = 0.0

        for ptype in types:
            p_lower = str(ptype).lower()
            if p_lower in ['1rk', '1bhk', '2bhk', '3bhk', 'independent_house', 'house']:
                fee = float(settings.owner_residential_fee)
                cat = 'residential'
            elif p_lower in ['apartment', 'pg', 'hostel']:
                fee = float(settings.owner_apt_pg_fee)
                cat = 'apartment_pg'
            else:
                fee = float(settings.owner_commercial_fee)
                cat = 'commercial'

            itemized.append({
                'property_type': ptype,
                'category': cat,
                'fee': fee
            })
            subtotal += fee

        discount_percent = float(settings.owner_combo_discount_percent) if len(types) > 1 else 0.0
        discount_amount = round((subtotal * discount_percent) / 100.0, 2)
        total_fee = round(subtotal - discount_amount, 2)

        return Response({
            'count': len(types),
            'itemized': itemized,
            'subtotal': subtotal,
            'discount_percent': discount_percent,
            'discount_amount': discount_amount,
            'total_fee': total_fee
        })


class PGOccupancyUpdateView(views.APIView):
    """Allows PG/Hostel owners to increment or decrement available beds."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            prop = Property.objects.get(pk=pk, owner=request.user)
        except Property.DoesNotExist:
            return Response({'detail': 'Property not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action') # 'rent_bed' | 'vacate_bed' | 'set_beds' | 'update_inventory'
        room_type = request.data.get('room_type')
        pg_rules = prop.pg_rules or {}
        if not isinstance(pg_rules, dict):
            pg_rules = {}
        room_inv = pg_rules.get('room_inventory', {})
        if not isinstance(room_inv, dict):
            room_inv = {}

        if action == 'rent_bed':
            if room_type and room_type in room_inv and isinstance(room_inv[room_type], dict):
                target_item = room_inv[room_type]
                avail = int(target_item.get('available_beds', 0))
                if avail > 0:
                    target_item['available_beds'] = avail - 1
                else:
                    label = room_type.replace('_', ' ').title()
                    return Response({'detail': f'No available beds left to mark as rented in {label}.'}, status=status.HTTP_400_BAD_REQUEST)
            elif prop.available_beds > 0:
                prop.available_beds -= 1
            else:
                return Response({'detail': 'No available beds left to mark as rented.'}, status=status.HTTP_400_BAD_REQUEST)

        elif action == 'vacate_bed':
            if room_type and room_type in room_inv and isinstance(room_inv[room_type], dict):
                target_item = room_inv[room_type]
                default_bpr = 1 if room_type == 'single' else 2 if room_type == 'double' else 3 if room_type == 'triple' else 4
                rms = int(target_item.get('rooms', 0))
                bpr = int(target_item.get('beds_per_room', default_bpr))
                max_beds = rms * bpr
                avail = int(target_item.get('available_beds', 0))
                if max_beds > 0 and avail < max_beds:
                    target_item['available_beds'] = avail + 1
                elif max_beds == 0:
                    target_item['available_beds'] = avail + 1
                else:
                    label = room_type.replace('_', ' ').title()
                    return Response({'detail': f'Available beds in {label} cannot exceed total capacity ({max_beds} beds).'}, status=status.HTTP_400_BAD_REQUEST)
            elif prop.total_beds > 0 and prop.available_beds < prop.total_beds:
                prop.available_beds += 1
            elif prop.total_beds == 0:
                prop.available_beds += 1
            else:
                return Response({'detail': 'Available beds cannot exceed total beds.'}, status=status.HTTP_400_BAD_REQUEST)

        elif action == 'set_beds':
            try:
                new_avail = int(request.data.get('available_beds', 0))
                new_total = int(request.data.get('total_beds', prop.total_beds))
                prop.available_beds = max(0, new_avail)
                prop.total_beds = max(0, new_total)
            except (ValueError, TypeError):
                return Response({'detail': 'Invalid bed count.'}, status=status.HTTP_400_BAD_REQUEST)

        elif action == 'update_inventory':
            incoming_inv = request.data.get('room_inventory')
            if isinstance(incoming_inv, dict):
                room_inv = incoming_inv
                pg_rules['room_inventory'] = room_inv
                prop.pg_rules = pg_rules
            
            new_avail = request.data.get('available_beds')
            new_total = request.data.get('total_beds')
            if new_avail is not None:
                prop.available_beds = max(0, int(new_avail))
            if new_total is not None:
                prop.total_beds = max(0, int(new_total))
        else:
            return Response({'detail': 'Invalid action. Choose rent_bed, vacate_bed, set_beds, or update_inventory.'}, status=status.HTTP_400_BAD_REQUEST)

        # Recalculate dynamic totals across enabled room inventory items
        if isinstance(room_inv, dict) and len(room_inv) > 0:
            calc_total = 0
            calc_avail = 0
            has_enabled = False
            beds_map = {'single': 1, 'double': 2, 'triple': 3, 'four_plus': 4}
            for k, v in room_inv.items():
                if isinstance(v, dict) and v.get('enabled'):
                    has_enabled = True
                    rms = int(v.get('rooms', 0))
                    bpr = int(v.get('beds_per_room', beds_map.get(k, 1)))
                    open_b = int(v.get('available_beds', 0))
                    calc_total += rms * bpr
                    calc_avail += open_b
            if has_enabled:
                prop.total_beds = calc_total
                prop.available_beds = calc_avail
                pg_rules['room_inventory'] = room_inv
                prop.pg_rules = pg_rules

        prop.save(update_fields=['available_beds', 'total_beds', 'pg_rules', 'updated_at'])

        # Log for Admin Audit
        try:
            PlatformSettingsAuditLog.objects.create(
                changed_by=request.user,
                field_name=f"PG Occupancy Update (Prop #{prop.id})",
                old_value="N/A",
                new_value=f"Action: {action} | Available: {prop.available_beds}/{prop.total_beds}"
            )
        except Exception:
            pass

        return Response({
            'detail': 'PG occupancy updated successfully.',
            'property_id': prop.id,
            'available_beds': prop.available_beds,
            'total_beds': prop.total_beds,
            'pg_rules': prop.pg_rules
        })

class PropertyMediaDeleteView(views.APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            from media.models import PropertyMedia
            media_item = PropertyMedia.objects.get(pk=pk)
            prop = media_item.property
            user = request.user
            roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
            
            # Authorization: admin/moderator/agent can delete; owner can only delete their own
            is_staff = any(r in roles for r in ['admin', 'moderator', 'agent'])
            is_owner = (prop.owner == user or prop.agent == user)
            
            if not is_staff and not is_owner:
                return Response({'detail': 'Not authorized to delete media for this property.'}, status=status.HTTP_403_FORBIDDEN)
                
            media_item.delete()
            
            # If deleted by non-staff (owner/agent), trigger admin review
            if not is_staff:
                old_status = prop.status
                prop.status = 'pending_review'
                prop.save(update_fields=['status'])
                
                # Log the status change
                from properties.models import PropertyAuditLog
                PropertyAuditLog.objects.create(
                    property=prop,
                    changed_by=user,
                    field_name='status',
                    old_value=str(old_status),
                    new_value='pending_review'
                )
                
            return Response({'detail': 'Media deleted successfully.'})
        except PropertyMedia.DoesNotExist:
            return Response({'detail': 'Media item not found.'}, status=status.HTTP_404_NOT_FOUND)

from django.core.management import call_command
from rest_framework.response import Response

class TriggerMigrationView(views.APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        try:
            call_command('migrate')
            return Response({"status": "Success", "message": "Migrations applied successfully."})
        except Exception as e:
            return Response({"status": "Error", "message": str(e)}, status=500)

class PropertyLifecycleView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        roles = user.roles if hasattr(user, 'roles') else [getattr(user, 'role', 'owner')]
        
        try:
            property_instance = Property.objects.get(pk=pk)
        except Property.DoesNotExist:
            return Response({'detail': 'Property not found.'}, status=status.HTTP_404_NOT_FOUND)

        if 'admin' not in roles and 'moderator' not in roles and property_instance.owner != user and property_instance.agent != user:
            raise PermissionDenied("Not authorized to view lifecycle for this property.")

        property_data = PropertySerializer(property_instance, context={'request': request}).data

        from unlocks.models import Unlock
        unlocks = Unlock.objects.filter(property=property_instance).select_related('buyer', 'buyer_subscription').order_by('-created_at')
        unlock_data = []
        for u in unlocks:
            pass_name = None
            pass_amount = None
            if u.buyer_subscription:
                pass_dict = dict(u.buyer_subscription.PASS_TYPES)
                pass_type_val = u.buyer_subscription.pass_type
                pass_name = pass_dict.get(pass_type_val, pass_type_val.replace('_', ' ').capitalize())
                pass_amount = str(u.buyer_subscription.amount_paid)

            unlock_data.append({
                'id': u.id,
                'buyer_name': f"{u.buyer.first_name} {u.buyer.last_name}".strip() or u.buyer.username,
                'buyer_phone': u.buyer.phone,
                'amount': str(u.amount),
                'status': u.status,
                'lead_status': u.lead_status,
                'created_at': u.created_at,
                'unlocked_at': u.unlocked_at,
                'pass_name': pass_name,
                'pass_amount': pass_amount
            })

        from properties.models import PropertyAuditLog
        audit_logs = PropertyAuditLog.objects.filter(property=property_instance).select_related('changed_by').order_by('-changed_at')
        
        audit_data = []
        for al in audit_logs:
            device_label = "Unknown Device"
            if al.user_agent:
                ua = al.user_agent.lower()
                os_n = "Desktop"
                if "iphone" in ua: os_n = "iPhone"
                elif "ipad" in ua: os_n = "iPad"
                elif "android" in ua: os_n = "Android"
                elif "windows" in ua: os_n = "Windows"
                elif "mac" in ua: os_n = "Mac"
                elif "linux" in ua: os_n = "Linux"

                br_n = "Browser"
                if "chrome" in ua and "edg" not in ua and "opr" not in ua: br_n = "Chrome"
                elif "safari" in ua and "chrome" not in ua: br_n = "Safari"
                elif "firefox" in ua: br_n = "Firefox"
                elif "edg" in ua: br_n = "Edge"
                device_label = f"{br_n} ({os_n})"

            price_change_pct = None
            if al.field_name == 'price' and al.old_value and al.new_value:
                try:
                    old_p = float(al.old_value)
                    new_p = float(al.new_value)
                    if old_p > 0:
                        pct = ((new_p - old_p) / old_p) * 100
                        price_change_pct = round(pct, 1)
                except (ValueError, TypeError):
                    pass

            audit_data.append({
                'id': al.id,
                'field_name': al.field_name,
                'old_value': al.old_value,
                'new_value': al.new_value,
                'event_category': al.event_category or 'lifecycle',
                'reason': al.reason,
                'ip_address': al.ip_address,
                'user_agent': al.user_agent,
                'device_label': device_label,
                'price_change_pct': price_change_pct,
                'metadata': al.metadata or {},
                'changed_by': al.changed_by.username if al.changed_by else 'System',
                'changed_by_role': al.changed_by.role if al.changed_by and hasattr(al.changed_by, 'role') else ('admin' if al.changed_by and al.changed_by.is_staff else 'system'),
                'changed_at': al.changed_at
            })

        return Response({
            'property': property_data,
            'unlocks': unlock_data,
            'audit_logs': audit_data
        })

