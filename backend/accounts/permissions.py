from rest_framework import permissions


class RolePermission(permissions.BasePermission):
    """Allow access only to users with given roles. Usage: RolePermission(allowed_roles=('ADMIN',))"""

    def __init__(self, allowed_roles=()):
        self.allowed_roles = set(allowed_roles)

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        # allow Django staff users as admin
        if getattr(user, 'is_staff', False):
            return True
        return user.role in self.allowed_roles


class IsAdmin(RolePermission):
    def __init__(self):
        super().__init__(allowed_roles=('ADMIN',))


class IsChauffeur(RolePermission):
    def __init__(self):
        super().__init__(allowed_roles=('CHAUFFEUR',))


class IsClient(RolePermission):
    def __init__(self):
        super().__init__(allowed_roles=('CLIENT',))


class IsSelfOrAdmin(permissions.BasePermission):
    """Allow object access if user is the object (self) or admin/staff."""

    def has_object_permission(self, request, view, obj):
        # obj will be a User instance
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'is_staff', False) or getattr(user, 'role', None) == 'ADMIN':
            return True
        return obj == user
