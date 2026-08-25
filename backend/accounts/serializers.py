from rest_framework import serializers
from .models import User, AgentKYC
from django.conf import settings
import boto3

def get_presigned_download_url(public_url):
    if not public_url:
        return public_url
    
    prefix = getattr(settings, 'R2_PUBLIC_URL_PREFIX', '')
    if prefix and public_url.startswith(prefix):
        object_key = public_url[len(prefix):].lstrip('/')
        try:
            s3 = boto3.client(
                's3',
                endpoint_url=settings.R2_ENDPOINT_URL,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name='auto',
            )
            signed_url = s3.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.R2_BUCKET_NAME,
                    'Key': object_key,
                },
                ExpiresIn=1800  # 30 minutes
            )
            return signed_url
        except Exception:
            return public_url
    return public_url

class AgentKYCSerializer(serializers.ModelSerializer):
    agent_username = serializers.CharField(source='user.username', read_only=True)
    agent_email = serializers.CharField(source='user.email', read_only=True)
    agent_phone = serializers.CharField(source='user.phone', read_only=True)

    class Meta:
        model = AgentKYC
        fields = '__all__'
        read_only_fields = ('user', 'status', 'verified_at', 'verified_by', 'created_at', 'updated_at')

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Dynamically sign URLs on serialization
        for field in ['aadhaar_front_url', 'aadhaar_back_url', 'pan_card_url', 'selfie_url']:
            if ret.get(field):
                ret[field] = get_presigned_download_url(ret[field])
        return ret


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    kyc_status = serializers.SerializerMethodField()
    kyc_upi_id = serializers.SerializerMethodField()
    kyc_selfie_url = serializers.SerializerMethodField()
    fraud_flags = serializers.IntegerField(source='fraud_flag_count', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'role', 'roles', 'phone', 'first_name', 'last_name', 'assigned_cities', 'is_phone_verified', 'force_password_change', 'sub_admin_permissions', 'kyc_status', 'kyc_upi_id', 'kyc_selfie_url', 'fraud_flag_count', 'fraud_flags', 'is_active', 'ownership_document_url', 'owner_kyc_status')

    def get_kyc_status(self, obj):
        try:
            return obj.kyc.status if hasattr(obj, 'kyc') and obj.kyc else 'pending'
        except Exception:
            return 'pending'

    def get_kyc_upi_id(self, obj):
        try:
            return obj.kyc.upi_id if hasattr(obj, 'kyc') and obj.kyc else ''
        except Exception:
            return ''

    def get_kyc_selfie_url(self, obj):
        try:
            return get_presigned_download_url(obj.kyc.selfie_url) if hasattr(obj, 'kyc') and obj.kyc else ''
        except Exception:
            return ''

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if 'ownership_document_url' in validated_data and validated_data['ownership_document_url']:
            validated_data['owner_kyc_status'] = 'submitted'
            
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'phone', 'first_name', 'last_name')

    def create(self, validated_data):
        # Force role to buyer, admins/moderators cannot be created here
        validated_data['role'] = 'buyer'
        validated_data['roles'] = ['buyer']
        user = User.objects.create_user(**validated_data)
        return user

class AgentSerializer(serializers.ModelSerializer):
    trust_score = serializers.SerializerMethodField()
    kyc_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'phone', 'first_name', 'last_name', 'trust_score', 'kyc_status')

    def get_kyc_status(self, obj):
        if hasattr(obj, 'kyc') and obj.kyc:
            return obj.kyc.status
        return 'pending'

    def get_trust_score(self, obj):
        from unlocks.models import Feedback
        feedbacks = Feedback.objects.filter(unlock__property__agent=obj)
        total = feedbacks.count()
        if total == 0:
            return None
        accurate = feedbacks.filter(is_accurate=True).count()
        return round((accurate / total) * 100)

