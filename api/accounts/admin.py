from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.utils.translation import gettext_lazy as _
from .models import User, Role, Permission, RolePermission, UserSession


class CustomUserCreationForm(UserCreationForm):
    """Custom user creation form for admin."""
    class Meta:
        model = User
        fields = ('email', 'name', 'surname', 'patronym', 'role', 'birth_date', 'birth_place')


class CustomUserChangeForm(UserChangeForm):
    """Custom user change form for admin."""
    class Meta:
        model = User
        fields = '__all__'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin configuration for User model."""
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    
    list_display = ['email', 'full_name', 'role', 'account_status', 'is_active', 'is_staff', 'date_joined']
    list_filter = ['role', 'account_status', 'is_active', 'is_staff', 'date_joined']
    search_fields = ['email', 'name', 'surname', 'patronym', 'full_name']
    ordering = ['-date_joined']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('name', 'surname', 'patronym', 'full_name', 'birth_date', 'birth_place')}),
        (_('Role and Status'), {'fields': ('role', 'account_status', 'is_active', 'is_staff', 'is_superuser')}),
        (_('Permissions'), {'fields': ('groups', 'user_permissions')}),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'name', 'surname', 'patronym', 'birth_date', 'birth_place', 'password1', 'password2', 'role'),
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """Override save_model to properly handle password hashing."""
        if not change:  # Creating new user
            obj.set_password(form.cleaned_data['password1'])
        elif 'password' in form.changed_data:
            # Password was changed
            obj.set_password(form.cleaned_data['password'])
        super().save_model(request, obj, form, change)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    """Admin configuration for Role model."""
    list_display = ['name', 'description']
    search_fields = ['name', 'description']


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    """Admin configuration for Permission model."""
    list_display = ['codename', 'description']
    search_fields = ['codename', 'description']


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    """Admin configuration for RolePermission model."""
    list_display = ['role', 'permission']
    list_filter = ['role', 'permission']
    search_fields = ['role__name', 'permission__codename']


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    """Admin configuration for UserSession model."""
    list_display = ['user', 'ip_address', 'created_at', 'last_activity_at']
    list_filter = ['created_at', 'last_activity_at']
    search_fields = ['user__email', 'ip_address', 'user_agent']
    readonly_fields = ['created_at', 'last_activity_at']
    ordering = ['-created_at']
