from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone as timezone_utils
from django.db.models.signals import post_save
from django.dispatch import receiver


class Role(models.Model):
    """Role model for user hierarchy."""
    name = models.CharField(max_length=50, unique=True, help_text='Role name: administrator, moderator, user')
    description = models.TextField(blank=True, help_text='Description of the hierarchy rank')
    
    class Meta:
        db_table = 'roles'
        verbose_name = 'role'
        verbose_name_plural = 'roles'
        ordering = ['id']
    
    def __str__(self):
        return self.name


class Permission(models.Model):
    """Permission model for granular access control."""
    codename = models.CharField(max_length=100, unique=True, help_text='Permission codename, e.g., task_create, task_delete_any')
    description = models.TextField(blank=True, help_text='Human readable description of what this allows')
    
    class Meta:
        db_table = 'permissions'
        verbose_name = 'permission'
        verbose_name_plural = 'permissions'
        ordering = ['codename']
    
    def __str__(self):
        return self.codename


class RolePermission(models.Model):
    """Junction table linking roles to permissions."""
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions', db_column='role_id')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='role_permissions', db_column='permission_id')
    
    class Meta:
        db_table = 'role_permissions'
        verbose_name = 'role permission'
        verbose_name_plural = 'role permissions'
        unique_together = [['role', 'permission']]
    
    def __str__(self):
        return f"{self.role.name} - {self.permission.codename}"


class UserSession(models.Model):
    """User session tracking model."""
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='sessions', db_column='user_id')
    ip_address = models.GenericIPAddressField(help_text='IP address of the connection')
    user_agent = models.TextField(help_text='Browser/Device details string')
    screen_size = models.CharField(max_length=20, blank=True, help_text='Screen size, e.g., 1920x1080')
    timezone = models.CharField(max_length=50, blank=True, default='UTC', help_text='Timezone, e.g., UTC, America/New_York')
    language = models.CharField(max_length=10, blank=True, default='en-US', help_text='Language, e.g., en-US, fr-FR')
    connection_number = models.IntegerField(default=1, help_text='A sequence number or ID for this specific connection')
    extra_metadata = models.JSONField(default=dict, blank=True, help_text='JSON: To store other parameters safely')
    created_at = models.DateTimeField(default=timezone_utils.now, help_text='When the login happened')
    last_activity_at = models.DateTimeField(auto_now=True, help_text='Updated on every request to track timeouts')
    
    class Meta:
        db_table = 'user_sessions'
        verbose_name = 'user session'
        verbose_name_plural = 'user sessions'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Session for {self.user.email} from {self.ip_address}"


class UserManager(BaseUserManager):
    """Custom user manager."""
    
    def get_queryset(self):
        """Return only active users by default."""
        return super().get_queryset().filter(account_status='active')
    
    def all_with_deleted(self):
        """Return all users including deleted/banned ones."""
        return super().get_queryset()
    
    def only_deleted(self):
        """Return only deleted users."""
        return super().get_queryset().filter(account_status='deleted')
    
    def only_banned(self):
        """Return only banned users."""
        return super().get_queryset().filter(account_status='banned')
    
    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user."""
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        
        # Set default role to 'user' if not provided
        if 'role' not in extra_fields:
            user_role = Role.objects.filter(name='user').first()
            if user_role:
                extra_fields['role'] = user_role
        
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser."""
        admin_role = Role.objects.filter(name='administrator').first()
        if not admin_role:
            raise ValueError('Administrator role does not exist. Run migrations and create_dummy_data first.')
        
        extra_fields.setdefault('role', admin_role)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('account_status', 'active')
        
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model with roles and account status."""
    
    class AccountStatus(models.TextChoices):
        ACTIVE = 'active', 'Active'
        BANNED = 'banned', 'Banned'
        DELETED = 'deleted', 'Deleted'
    
    # Basic fields
    email = models.EmailField(unique=True, max_length=255)
    name = models.CharField(max_length=100)
    surname = models.CharField(max_length=100)
    patronym = models.CharField(max_length=100, blank=True)
    full_name = models.CharField(max_length=300, blank=True, help_text='Combined name+surname+patronym')
    
    # Role field - ForeignKey to Role
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, related_name='users', db_column='role_id')
    
    # Additional profile fields
    birth_date = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=200, blank=True)
    
    # Status fields
    is_active = models.BooleanField(default=False, help_text='TRUE = Currently Logged In, FALSE = Logged Out')
    account_status = models.CharField(
        max_length=20,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
        help_text='To handle admin bans separate from login status'
    )
    is_staff = models.BooleanField(default=False)
    
    # Timestamps
    date_joined = models.DateTimeField(default=timezone_utils.now)
    last_login = models.DateTimeField(null=True, blank=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name', 'surname']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'user'
        verbose_name_plural = 'users'
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"
    
    def save(self, *args, **kwargs):
        """Override save to update full_name and set is_staff for moderators."""
        # Update full_name from name, surname, patronym
        self.full_name = f"{self.surname} {self.name} {self.patronym}".strip()
        
        # Set is_staff=True for moderators
        if self.role and self.role.name == 'moderator':
            self.is_staff = True
        
        super().save(*args, **kwargs)
    
    def get_full_name(self):
        """Return the full name."""
        if self.full_name:
            return self.full_name
        return f"{self.surname} {self.name} {self.patronym}".strip()
    
    def soft_delete(self):
        """Soft delete the user."""
        self.account_status = self.AccountStatus.DELETED
        self.is_active = False
        self.save()
    
    def ban(self):
        """Ban the user."""
        self.account_status = self.AccountStatus.BANNED
        self.is_active = False
        self.save()
    
    def is_administrator(self):
        """Check if user is administrator."""
        return self.role and self.role.name == 'administrator'
    
    def is_moderator(self):
        """Check if user is moderator."""
        return self.role and self.role.name == 'moderator'
    
    def is_user(self):
        """Check if user has user role."""
        return self.role and self.role.name == 'user'
    
    def has_permission(self, permission_codename):
        """Check if user has a specific permission via their role."""
        if not self.role:
            return False
        return self.role.role_permissions.filter(permission__codename=permission_codename).exists()
