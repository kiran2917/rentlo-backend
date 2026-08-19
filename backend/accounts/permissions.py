from rest_framework import permissions

def _user_has_role(user, role_name):
    if not user or not user.is_authenticated:
        return False
    roles = getattr(user, 'roles', None)
    if roles and isinstance(roles, list):
        return role_name in roles
    return getattr(user, 'role', '') == role_name

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return _user_has_role(request.user, 'admin')

class IsModerator(permissions.BasePermission):
    def has_permission(self, request, view):
        return _user_has_role(request.user, 'moderator')

class IsAgent(permissions.BasePermission):
    def has_permission(self, request, view):
        return _user_has_role(request.user, 'agent')

class IsBuyer(permissions.BasePermission):
    def has_permission(self, request, view):
        return _user_has_role(request.user, 'buyer')

class IsAdminOrModerator(permissions.BasePermission):
    def has_permission(self, request, view):
        return _user_has_role(request.user, 'admin') or _user_has_role(request.user, 'moderator')


def check_subadmin_authority(user, authority_name):
    if not user or not user.is_authenticated:
        return False
    roles = getattr(user, 'roles', []) or [getattr(user, 'role', '')]
    # Full Super Admin (without subadmin tag) gets full access
    if 'admin' in roles and 'sub_admin' not in roles:
        return True
    if 'admin' in roles or 'sub_admin' in roles or 'moderator' in roles:
        perms = getattr(user, 'sub_admin_permissions', {}) or {}
        if 'admin' in roles and not perms:
            return True
        return bool(perms.get(authority_name, False))
    return False


