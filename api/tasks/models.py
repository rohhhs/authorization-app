from django.db import models
from django.utils import timezone
from accounts.models import User


class UserTaskManager(models.Manager):
    """Custom manager for UserTask model with soft deletion support."""
    
    def get_queryset(self):
        """Return only non-deleted tasks by default."""
        return super().get_queryset().filter(is_deleted=False)
    
    def all_with_deleted(self):
        """Return all tasks including deleted ones."""
        return super().get_queryset()
    
    def only_deleted(self):
        """Return only deleted tasks."""
        return super().get_queryset().filter(is_deleted=True)


class UserTask(models.Model):
    """User task model with nesting support and status tracking."""
    
    class TaskStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        DONE = 'done', 'Done'
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_tasks', db_column='user_id')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subtasks', db_column='parent_id')
    status = models.CharField(
        max_length=20,
        choices=TaskStatus.choices,
        default=TaskStatus.PENDING,
        help_text='Task status: pending, in_progress, done'
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    
    objects = UserTaskManager()
    
    class Meta:
        db_table = 'user_tasks'
        ordering = ['-created_at']
        verbose_name = 'user task'
        verbose_name_plural = 'user tasks'
    
    def __str__(self):
        return self.title
    
    def soft_delete(self):
        """Soft delete the task."""
        self.is_deleted = True
        self.save()
    
    def get_all_subtasks(self):
        """Recursively get all subtasks."""
        subtasks = list(self.subtasks.filter(is_deleted=False))
        for subtask in subtasks:
            subtasks.extend(subtask.get_all_subtasks())
        return subtasks


# Keep Task as an alias for backward compatibility during migration
Task = UserTask
