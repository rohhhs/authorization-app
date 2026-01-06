from rest_framework import status, generics, permissions as drf_permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import models
from .models import UserTask
from .serializers import UserTaskSerializer
from .permissions import IsTaskOwnerOrModeratorOrAdmin, IsAdministrator
from accounts.models import User, Role
from accounts.serializers import UserSerializer


class PublicTaskListView(generics.ListAPIView):
    """Public task list endpoint that doesn't require authentication."""
    serializer_class = UserTaskSerializer
    permission_classes = [drf_permissions.AllowAny]
    
    def get_queryset(self):
        """Return all non-deleted tasks."""
        return UserTask.objects.filter(is_deleted=False)


class TaskListCreateView(generics.ListCreateAPIView):
    """List and create tasks."""
    serializer_class = UserTaskSerializer
    permission_classes = [drf_permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Return tasks based on user role and optional group filter."""
        user = self.request.user
        queryset = None
        
        if user.is_administrator():
            # Administrators see all non-deleted tasks
            queryset = UserTask.objects.all()
        elif user.is_moderator():
            # Moderators see all user tasks and their own tasks
            user_role = Role.objects.filter(name='user').first()
            if user_role:
                queryset = UserTask.objects.filter(
                    models.Q(user__role=user_role) | models.Q(user=user)
                )
            else:
                queryset = UserTask.objects.filter(user=user)
        else:
            # Users see only their own tasks
            queryset = UserTask.objects.filter(user=user)
        
        # Apply group filter if provided
        group_filter = self.request.query_params.get('group', None)
        if group_filter and (user.is_administrator() or user.is_moderator()):
            role = Role.objects.filter(name=group_filter).first()
            if role:
                queryset = queryset.filter(user__role=role)
        
        return queryset
    
    def perform_create(self, serializer):
        """Create a new task."""
        serializer.save(user=self.request.user)


class TaskDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve and update a task."""
    serializer_class = UserTaskSerializer
    permission_classes = [drf_permissions.IsAuthenticated, IsTaskOwnerOrModeratorOrAdmin]
    
    def get_queryset(self):
        """Return tasks based on user role."""
        user = self.request.user
        
        if user.is_administrator():
            return UserTask.objects.all()
        elif user.is_moderator():
            user_role = Role.objects.filter(name='user').first()
            if user_role:
                return UserTask.objects.filter(
                    models.Q(user__role=user_role) | models.Q(user=user)
                )
            return UserTask.objects.filter(user=user)
        else:
            return UserTask.objects.filter(user=user)


class TaskDeleteView(generics.DestroyAPIView):
    """Delete a task (soft delete)."""
    serializer_class = UserTaskSerializer
    permission_classes = [drf_permissions.IsAuthenticated, IsTaskOwnerOrModeratorOrAdmin]
    
    def get_queryset(self):
        """Return tasks based on user role."""
        user = self.request.user
        
        if user.is_administrator():
            return UserTask.objects.all()
        elif user.is_moderator():
            user_role = Role.objects.filter(name='user').first()
            if user_role:
                return UserTask.objects.filter(
                    models.Q(user__role=user_role) | models.Q(user=user)
                )
            return UserTask.objects.filter(user=user)
        else:
            return UserTask.objects.filter(user=user)
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete the task."""
        task = self.get_object()
        task.soft_delete()
        return Response({'message': 'Task deleted successfully'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdministrator])
def user_list_view(request):
    """List all users (Administrator only)."""
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdministrator])
def promote_user_view(request, user_id):
    """Promote user to moderator (Administrator only)."""
    user = get_object_or_404(User, id=user_id)
    moderator_role = Role.objects.filter(name='moderator').first()
    
    if not moderator_role:
        return Response({
            'error': 'Moderator role does not exist'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    user_role = Role.objects.filter(name='user').first()
    if user.role == user_role:
        user.role = moderator_role
        user.save()
        return Response({
            'message': f'User {user.email} promoted to moderator',
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
    else:
        return Response({
            'error': 'User is not a regular user or is already a moderator/administrator'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAdministrator])
def demote_user_view(request, user_id):
    """Demote moderator to user (Administrator only)."""
    user = get_object_or_404(User, id=user_id)
    moderator_role = Role.objects.filter(name='moderator').first()
    user_role = Role.objects.filter(name='user').first()
    
    if not user_role:
        return Response({
            'error': 'User role does not exist'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if user.role == moderator_role:
        user.role = user_role
        user.save()
        return Response({
            'message': f'Moderator {user.email} demoted to user',
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
    else:
        return Response({
            'error': 'User is not a moderator'
        }, status=status.HTTP_400_BAD_REQUEST)
