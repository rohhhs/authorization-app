from rest_framework import permissions
from accounts.models import User, Role


class IsTaskOwnerOrModeratorOrAdmin(permissions.BasePermission):
    """Permission to allow task owners, moderators, and admins to delete/edit tasks."""
    
    def has_object_permission(self, request, view, obj):
        """Check if user has permission to perform action on task."""
        user = request.user
        
        # Allow administrators to perform any action on any task
        if user.is_administrator():
            return True
        
        # Allow moderators to perform actions on user tasks and their own tasks
        if user.is_moderator():
            user_role = Role.objects.filter(name='user').first()
            if user_role and obj.user.role == user_role:
                return True
            # Also allow moderators to edit their own tasks
            if obj.user == user:
                return True
        
        # Allow users to perform actions on their own tasks
        if obj.user == user:
            return True
        
        return False


class IsAdministrator(permissions.BasePermission):
    """Permission to allow only administrators."""
    
    def has_permission(self, request, view):
        """Check if user is administrator."""
        return request.user.is_authenticated and request.user.is_administrator()


class HasPermission(permissions.BasePermission):
    """Permission to check if user has a specific permission via their role."""
    
    def __init__(self, permission_codename):
        self.permission_codename = permission_codename
    
    def has_permission(self, request, view):
        """Check if user has the required permission."""
        if not request.user.is_authenticated:
            return False
        return request.user.has_permission(self.permission_codename)
