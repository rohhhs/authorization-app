from django.contrib import admin
from .models import UserTask


@admin.register(UserTask)
class UserTaskAdmin(admin.ModelAdmin):
    """Admin configuration for UserTask model."""
    list_display = ['title', 'user', 'parent', 'status', 'created_at', 'is_deleted']
    list_filter = ['status', 'is_deleted', 'created_at']
    search_fields = ['title', 'description', 'user__email', 'user__name']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        (None, {'fields': ('title', 'description', 'user', 'parent', 'status')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
        ('Status', {'fields': ('is_deleted',)}),
    )
