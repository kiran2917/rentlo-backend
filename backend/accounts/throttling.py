from rest_framework.throttling import UserRateThrottle, ScopedRateThrottle, AnonRateThrottle

class RoleBasedUserRateThrottle(UserRateThrottle):
    """
    Role-based User Rate Throttle:
    - Admins & Sub-Admins: NO LIMIT (Unlimited)
    - Owners & Field Agents: High Capacity (100,000 requests/day)
    - Buyers: Standard (50,000 requests/day)
    """
    def allow_request(self, request, view):
        if request.user and request.user.is_authenticated:
            roles = request.user.roles if isinstance(request.user.roles, list) else [str(request.user.roles)]
            # Admins & Sub-admins bypass throttling completely
            if any(r in ['admin', 'sub_admin', 'subadmin'] for r in roles) or request.user.is_staff or request.user.is_superuser:
                return True
        return super().allow_request(request, view)

    def get_rate(self):
        if hasattr(self, 'request') and self.request and self.request.user and self.request.user.is_authenticated:
            roles = self.request.user.roles if isinstance(self.request.user.roles, list) else [str(self.request.user.roles)]
            if 'agent' in roles or 'owner' in roles:
                return '100000/day'
        return getattr(self, 'rate', '50000/day')


class RoleBasedScopedRateThrottle(ScopedRateThrottle):
    """
    Role-based Scoped Rate Throttle:
    - Admins & Sub-Admins: NO LIMIT (Unlimited)
    - Owners & Agents: Bypasses operational rate limits for listings, leads, CRM, and management
    """
    def allow_request(self, request, view):
        if request.user and request.user.is_authenticated:
            roles = request.user.roles if isinstance(request.user.roles, list) else [str(request.user.roles)]
            # Admins & Sub-admins bypass scoped rate limits completely
            if any(r in ['admin', 'sub_admin', 'subadmin'] for r in roles) or request.user.is_staff or request.user.is_superuser:
                return True
        return super().allow_request(request, view)
