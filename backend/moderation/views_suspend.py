from rest_framework import views, status
from rest_framework.response import Response
from accounts.permissions import IsAdminOrModerator
from accounts.models import User

class SuspendAgentView(views.APIView):
    permission_classes = [IsAdminOrModerator]

    def patch(self, request, pk):
        try:
            agent = User.objects.get(pk=pk)
            agent.is_active = False
            agent.save()
            return Response({'detail': 'Agent suspended successfully.'})
        except User.DoesNotExist:
            return Response({'detail': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
