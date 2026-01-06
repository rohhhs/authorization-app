from rest_framework import serializers
from .models import UserTask
from accounts.serializers import UserSerializer


class UserTaskSerializer(serializers.ModelSerializer):
    """Serializer for UserTask model with nested task support."""
    user_info = serializers.SerializerMethodField()
    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=UserTask.objects.all(),
        source='parent',
        required=False,
        allow_null=True
    )
    subtasks = serializers.SerializerMethodField()
    
    class Meta:
        model = UserTask
        fields = ('id', 'title', 'description', 'user', 'user_info', 'parent_id', 'parent', 
                  'status', 'subtasks', 'created_at', 'updated_at', 'is_deleted')
        read_only_fields = ('id', 'user', 'user_info', 'created_at', 'updated_at', 'is_deleted', 'subtasks')
    
    def get_user_info(self, obj):
        """Return user information."""
        return {
            'id': obj.user.id,
            'email': obj.user.email,
            'full_name': obj.user.get_full_name(),
            'role_name': obj.user.role.name if obj.user.role else None
        }
    
    def get_subtasks(self, obj):
        """Return nested subtasks."""
        subtasks = obj.subtasks.filter(is_deleted=False)
        return UserTaskSerializer(subtasks, many=True).data


# Keep TaskSerializer as alias for backward compatibility
TaskSerializer = UserTaskSerializer
