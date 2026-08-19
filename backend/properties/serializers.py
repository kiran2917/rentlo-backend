from rest_framework import serializers
from .models import Property, ConsentOTP, City, Locality, PlatformSettings
from media.models import PropertyMedia

class PropertyMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropertyMedia
        fields = ('id', 'image_url', 'medium_url', 'thumbnail_url', 'image_hash', 'display_order')

import hashlib

class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = '__all__'

class LocalitySerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)
    class Meta:
        model = Locality
        fields = ('id', 'name', 'city', 'city_name')

class FlexibleLocalityField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        if data is None or data == '' or data == 'null':
            return None
        if isinstance(data, Locality):
            return data
        if isinstance(data, int) or (isinstance(data, str) and data.isdigit()):
            try:
                return Locality.objects.get(pk=int(data))
            except Locality.DoesNotExist:
                return None
        if isinstance(data, str) and data.strip():
            locality_name = data.strip()
            loc = Locality.objects.filter(name__iexact=locality_name).first()
            if loc:
                return loc
            request = self.context.get('request')
            city_id = None
            if request and hasattr(request, 'data'):
                city_id = request.data.get('city_id') or request.data.get('city')
            city_obj = None
            if city_id:
                city_obj = City.objects.filter(pk=city_id).first()
            if not city_obj:
                city_obj = City.objects.first()
            if city_obj:
                loc = Locality.objects.filter(city=city_obj, name__iexact=locality_name).first()
                if not loc:
                    loc = Locality.objects.create(city=city_obj, name=locality_name.title())
                return loc
            return None
        return super().to_internal_value(data)

class PropertySerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(required=False, allow_blank=True)
    owner_phone = serializers.CharField(required=False, allow_blank=True)
    media = PropertyMediaSerializer(many=True, read_only=True)
    uploaded_media = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )
    
    city_name_input = serializers.CharField(write_only=True, required=False)
    state_name_input = serializers.CharField(write_only=True, required=False)
    locality_name_input = serializers.CharField(write_only=True, required=False)
    locality = FlexibleLocalityField(queryset=Locality.objects.all(), required=False, allow_null=True)
    
    # We will use SerializerMethodFields to dynamically return masked or unmasked data
    display_lat = serializers.SerializerMethodField()
    display_lng = serializers.SerializerMethodField()
    owner_name_display = serializers.SerializerMethodField()
    owner_phone_display = serializers.SerializerMethodField()
    owner_has_whatsapp = serializers.SerializerMethodField()
    is_unlocked = serializers.SerializerMethodField()
    display_address = serializers.SerializerMethodField()
    locality_details = LocalitySerializer(source='locality', read_only=True)
    is_verified = serializers.SerializerMethodField()
    last_confirmed_at = serializers.DateTimeField(source='updated_at', read_only=True)
    trust_score = serializers.SerializerMethodField()
    feedback_count = serializers.SerializerMethodField()
    unlock_fee = serializers.SerializerMethodField()
    onboarding_fee = serializers.SerializerMethodField()
    creator_info = serializers.SerializerMethodField()
    
    exact_lat = serializers.DecimalField(max_digits=10, decimal_places=8, required=False, allow_null=True)
    exact_lng = serializers.DecimalField(max_digits=11, decimal_places=8, required=False, allow_null=True)
    exact_address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    consent_proof_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    voice_note_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    virtual_tour_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    ownership_document = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    # owner_name and owner_phone are defined at the top
    
    display_title = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = (
            'id', 'agent', 'owner_name', 'owner_phone', 'exact_lat', 'exact_lng', 'exact_address',
            'display_title', 'owner_name_display', 'owner_phone_display', 'owner_has_whatsapp', 'display_lat', 'display_lng', 'display_address',
            'price', 'property_category', 'property_type', 'description', 'status', 'consent_proof_url', 'voice_note_url',
            'rejection_reason', 'created_at', 'updated_at', 'expires_at', 'media', 'uploaded_media',
            'is_unlocked', 'locality', 'locality_details', 'is_verified', 'last_confirmed_at',
            'trust_score', 'feedback_count', 'duplicate_of', 'unlock_fee', 'onboarding_fee', 
            'onboarding_payment_method', 'onboarding_payment_status', 'registration_fee_paid', 'registration_payment_method',
            'bedrooms', 'bathrooms', 'balconies', 'carpet_area', 'furnishing_status',
            'facing_direction', 'floor_number', 'total_floors', 'property_age',
            'security_deposit', 'maintenance_charges', 'available_from',
            'preferred_tenants', 'food_preference', 'pet_policy', 'amenities',
            'owner', 'added_by', 'verification_status', 'ownership_document', 'virtual_tour_url',
            'creator_info', 'city_name_input', 'state_name_input', 'locality_name_input',
            
            # New fields
            'maintenance_included_in_rent', 'lock_in_period_months', 'lease_term_months',
            'super_built_up_area', 'covered_parking_spots', 'open_parking_spots',
            'power_backup', 'water_supply', 'gated_security',
            'house_floor', 'pg_gender', 'total_beds', 'available_beds', 'is_featured', 'is_hero_spotlight',
            'pg_sharing_type', 'pg_attached_washroom', 'pg_food_provided', 'pg_amenities', 'pg_rules',
            'commercial_building_type', 'commercial_washrooms', 'commercial_pantry',
            'commercial_central_ac', 'retail_frontage_feet', 'warehouse_ceiling_height_feet',
            'warehouse_floor_load_capacity', 'industrial_power_capacity_kw', 'heavy_vehicle_access'
        )
        read_only_fields = ('agent', 'owner', 'added_by', 'verification_status', 'rejection_reason', 'created_at', 'updated_at')

    def get_creator_info(self, obj):
        if obj.agent:
            role_label = "Admin" if obj.agent.role == "admin" else "Agent"
            return {
                'id': obj.agent.id,
                'username': obj.agent.username,
                'name': obj.agent.get_full_name() or obj.agent.username,
                'role': obj.agent.role,
                'label': f"{role_label}: {obj.agent.username}"
            }
        if obj.owner:
            return {
                'id': obj.owner.id,
                'username': obj.owner.username,
                'name': obj.owner.get_full_name() or obj.owner.username,
                'role': getattr(obj.owner, 'role', 'owner'),
                'label': f"Owner: {obj.owner.username}"
            }
        added_by_str = str(obj.added_by or 'self').lower()
        if 'admin' in added_by_str:
            role = 'admin'
        elif 'agent' in added_by_str:
            role = 'agent'
        else:
            role = 'owner'
        return {
            'id': None,
            'username': obj.added_by or obj.owner_name or 'Self',
            'name': obj.owner_name or 'Owner',
            'role': role,
            'label': f"{role.capitalize()}: {obj.added_by or obj.owner_name or 'Self-listed'}"
        }

    def get_is_verified(self, obj):
        return obj.status == 'live' and bool(obj.consent_proof_url)

    def get_trust_score(self, obj):
        from unlocks.models import Feedback
        feedbacks = Feedback.objects.filter(unlock__property=obj)
        total = feedbacks.count()
        if total == 0:
            return None
        accurate = feedbacks.filter(is_accurate=True).count()
        return round((accurate / total) * 100)

    def get_feedback_count(self, obj):
        from unlocks.models import Feedback
        return Feedback.objects.filter(unlock__property=obj).count()

    def get_unlock_fee(self, obj):
        # Always return the current global fee so changes apply retroactively
        return PlatformSettings.load().buyer_unlock_fee

    def get_onboarding_fee(self, obj):
        # Always return the current global fee so changes apply retroactively
        return PlatformSettings.load().owner_onboarding_fee

    def get_display_title(self, obj):
        is_unlocked = self.get_is_unlocked(obj)
        locality_name = obj.locality.name if obj.locality else ""
        city_name = obj.locality.city.name if obj.locality and obj.locality.city else ""
        location_str = f"in {locality_name}" if locality_name else ""
        if locality_name and city_name:
            location_str += f", {city_name}"

        is_pg = obj.property_category == 'pg' or (obj.property_type and 'pg' in str(obj.property_type).lower())
        if is_pg:
            gender_raw = str(obj.pg_gender or '').lower()
            if 'boy' in gender_raw or gender_raw == 'male':
                gender_label = "Boys PG"
            elif 'girl' in gender_raw or 'women' in gender_raw or gender_raw == 'female':
                gender_label = "Girls PG"
            elif 'co' in gender_raw or 'unisex' in gender_raw or 'both' in gender_raw:
                gender_label = "Co-Living PG"
            else:
                gender_label = "PG"

            return f"Verified {gender_label} {location_str}".strip()

        # Non-PG properties
        bhk_prefix = f"{obj.bedrooms} BHK " if obj.bedrooms else ""
        type_label = obj.get_property_type_display() if hasattr(obj, 'get_property_type_display') else 'Property'
        return f"{bhk_prefix}{type_label} {location_str}".strip()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Security Data Masking: If property is not unlocked, strip raw PII and exact coordinates
        if not data.get('is_unlocked', False):
            data['exact_lat'] = None
            data['exact_lng'] = None
            data['exact_address'] = None
            data['owner_name'] = "Hidden (Unlock required)"
            data['owner_phone'] = "Hidden (Unlock required)"
            data['display_address'] = "Hidden (Unlock required to view building & exact address)"

            # PII & PG Name Masking in description for locked buyers
            if data.get('description'):
                desc = str(data['description'])
                import re
                desc = re.sub(r'\b[6-9]\d{9}\b', '[Phone Hidden]', desc)
                desc = re.sub(r'\b\+?91[\s-]?\d{10}\b', '[Phone Hidden]', desc)
                desc = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[Email Hidden]', desc)
                desc = re.sub(r'https?://\S+|www\.\S+', '[Link Hidden]', desc)
                data['description'] = desc

        return data

    def get_is_unlocked(self, obj):
        # Check global bypass
        settings = PlatformSettings.load()
        if settings.bypass_buyer_payment:
            return True
            
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
            
        user = request.user
        roles = getattr(user, 'roles', [getattr(user, 'role', '')])
        user_role = getattr(user, 'role', '')

        # Super Admins and Moderators can view all property details unlocked
        if 'admin' in roles or 'moderator' in roles or user_role in ['admin', 'moderator']:
            return True

        # Property Owner can view their own property unlocked
        if obj.owner == user or (obj.owner_name and user.username == obj.owner_name):
            return True

        # Agent can view ONLY their own registered property unlocked
        if obj.agent == user or (obj.added_by and f"agent:{user.id}" in str(obj.added_by)):
            return True

        # Pre-fetched optimization check from view context (eliminates N+1 DB queries)
        unlocked_ids = self.context.get('unlocked_property_ids')
        if unlocked_ids is not None:
            return obj.id in unlocked_ids

        # Otherwise, check if user has purchased/unlocked this property
        from unlocks.models import Unlock
        return Unlock.objects.filter(buyer=user, property=obj, status='paid').exists()

    def _get_jittered_coordinates(self, obj):
        # Deterministic jitter based on property ID
        # 0.003 degrees is approx 330 meters
        hash_val = int(hashlib.md5(str(obj.id).encode()).hexdigest()[:8], 16)
        # Use hash to get a consistent angle (0-360) and distance (0.0027 to 0.0045 degrees)
        angle = (hash_val % 360)
        distance = 0.0027 + ((hash_val % 100) / 100.0) * 0.0018
        
        import math
        lat_offset = distance * math.cos(math.radians(angle))
        lng_offset = distance * math.sin(math.radians(angle))
        
        return float(obj.exact_lat) + lat_offset, float(obj.exact_lng) + lng_offset

    def get_display_lat(self, obj):
        if not self.get_is_unlocked(obj) and obj.exact_lat:
            j_lat, _ = self._get_jittered_coordinates(obj)
            return j_lat
        if obj.exact_lat:
            return float(obj.exact_lat)
        if obj.locality and hasattr(obj.locality, 'latitude') and obj.locality.latitude:
            return float(obj.locality.latitude)
        return 15.3647

    def get_display_lng(self, obj):
        if not self.get_is_unlocked(obj) and obj.exact_lng:
            _, j_lng = self._get_jittered_coordinates(obj)
            return j_lng
        if obj.exact_lng:
            return float(obj.exact_lng)
        if obj.locality and hasattr(obj.locality, 'longitude') and obj.locality.longitude:
            return float(obj.locality.longitude)
        return 75.1240

    def get_owner_name_display(self, obj):
        return obj.owner_name if self.get_is_unlocked(obj) else "Hidden (Unlock required)"

    def get_owner_phone_display(self, obj):
        return obj.owner_phone if self.get_is_unlocked(obj) else "Hidden (Unlock required)"

    def get_owner_has_whatsapp(self, obj):
        if hasattr(obj, 'has_whatsapp') and obj.has_whatsapp is False:
            return False
        if obj.owner and hasattr(obj.owner, 'has_whatsapp'):
            return bool(obj.owner.has_whatsapp)
        return getattr(obj, 'has_whatsapp', True)

    def get_display_address(self, obj):
        return obj.exact_address if self.get_is_unlocked(obj) else "Hidden (Unlock required to view building & exact address)"

    def create(self, validated_data):
        uploaded_media = validated_data.pop('uploaded_media', [])
        # Force status to pending_review on create
        validated_data['status'] = 'pending_review'
        
        duplicate_of = None
        locality_obj = validated_data.get('locality')
        
        city_name = validated_data.pop('city_name_input', None)
        state_name = validated_data.pop('state_name_input', 'Karnataka')
        locality_name = validated_data.pop('locality_name_input', None)
        
        if not locality_obj and (city_name or locality_name):
            c_clean = str(city_name).strip() if city_name else ""
            l_clean = str(locality_name).strip() if locality_name else ""
            s_clean = str(state_name).strip() if state_name else "Karnataka"

            if c_clean:
                city_obj = City.objects.filter(name__iexact=c_clean).first()
                if not city_obj:
                    city_obj = City.objects.create(name=c_clean.title(), state=s_clean.title())
            else:
                city_obj = City.objects.first()

            if city_obj and l_clean:
                locality_obj = Locality.objects.filter(city=city_obj, name__iexact=l_clean).first()
                if not locality_obj:
                    locality_obj = Locality.objects.create(city=city_obj, name=l_clean.title())
                validated_data['locality'] = locality_obj
            
        owner_phone = validated_data.get('owner_phone')
        
        image_hashes = []
        for m in uploaded_media:
            if isinstance(m, dict) and m.get('image_hash'):
                image_hashes.append(m.get('image_hash'))
                
        if locality_obj:
            city_id = locality_obj.city_id
            exact_addr = validated_data.get('exact_address')
            prop_type = validated_data.get('property_type')
            
            # Check by exact building address + property type + phone (true duplicate listing)
            if exact_addr and len(str(exact_addr).strip()) > 5:
                addr_duplicate = Property.objects.filter(
                    locality__city_id=city_id,
                    owner_phone=owner_phone,
                    property_type=prop_type,
                    exact_address__iexact=str(exact_addr).strip()
                ).exclude(status__in=['rejected', 'expired']).first()

                if addr_duplicate:
                    duplicate_of = addr_duplicate

            # Check by uploaded image hashes if not already matched by address
            if not duplicate_of and image_hashes:
                hash_duplicate = Property.objects.filter(
                    locality__city_id=city_id,
                    media__image_hash__in=image_hashes
                ).exclude(status__in=['rejected', 'expired']).first()
                if hash_duplicate:
                    duplicate_of = hash_duplicate
                    
        validated_data['duplicate_of'] = duplicate_of
        
        settings = PlatformSettings.load()
        validated_data['unlock_fee'] = settings.buyer_unlock_fee
        validated_data['onboarding_fee'] = settings.owner_onboarding_fee
        if settings.bypass_owner_payment:
            validated_data['onboarding_payment_status'] = 'paid'
        
        property_obj = Property.objects.create(**validated_data)
        
        for idx, media_dict in enumerate(uploaded_media):
            # Signature might still pass a simple string? No, signature is just set to consent_proof_url.
            # But just in case, handle dict vs string
            if isinstance(media_dict, dict):
                PropertyMedia.objects.create(
                    property=property_obj,
                    image_url=media_dict.get('image_url', ''),
                    medium_url=media_dict.get('medium_url', ''),
                    thumbnail_url=media_dict.get('thumbnail_url', ''),
                    image_hash=media_dict.get('image_hash', None),
                    display_order=idx
                )
            else:
                PropertyMedia.objects.create(
                    property=property_obj,
                    image_url=media_dict,
                    display_order=idx
                )
            
        return property_obj

class RequestOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)

class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=6)

from .models import SavedSearch

class SavedSearchSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)
    locality_name = serializers.CharField(source='locality.name', read_only=True)

    class Meta:
        model = SavedSearch
        fields = ('id', 'city', 'city_name', 'locality', 'locality_name', 'property_type', 'min_price', 'max_price', 'created_at')
        read_only_fields = ('buyer', 'created_at')
