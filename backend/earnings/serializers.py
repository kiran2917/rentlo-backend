from rest_framework import serializers
from .models import CommissionRule, EarningEntry, AgentPayoutBatch
from properties.serializers import CitySerializer, PropertySerializer
from accounts.serializers import UserSerializer

class AgentPayoutBatchSerializer(serializers.ModelSerializer):
    agent_details = UserSerializer(source='agent', read_only=True)
    paid_by_details = UserSerializer(source='paid_by', read_only=True)

    class Meta:
        model = AgentPayoutBatch
        fields = '__all__'

class CommissionRuleSerializer(serializers.ModelSerializer):
    city_details = CitySerializer(source='city', read_only=True)
    agent_details = UserSerializer(source='agent', read_only=True)

    class Meta:
        model = CommissionRule
        fields = '__all__'

class EarningEntrySerializer(serializers.ModelSerializer):
    agent_details = UserSerializer(source='agent', read_only=True)
    property_details = PropertySerializer(source='property', read_only=True)
    paid_by_details = UserSerializer(source='paid_by', read_only=True)

    class Meta:
        model = EarningEntry
        fields = '__all__'
