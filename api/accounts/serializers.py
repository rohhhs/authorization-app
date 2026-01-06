from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
import yaml
from pathlib import Path
from .models import User, Role, Permission, UserSession


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model."""
    class Meta:
        model = Role
        fields = ('id', 'name', 'description')
        read_only_fields = ('id',)


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer for Permission model."""
    class Meta:
        model = Permission
        fields = ('id', 'codename', 'description')
        read_only_fields = ('id',)


class UserSessionSerializer(serializers.ModelSerializer):
    """Serializer for UserSession model."""
    class Meta:
        model = UserSession
        fields = ('id', 'ip_address', 'user_agent', 'screen_size', 'timezone', 'language', 
                  'connection_number', 'created_at', 'last_activity_at')
        read_only_fields = ('id', 'created_at', 'last_activity_at')


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_repeat = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ('email', 'name', 'surname', 'patronym', 'password', 'password_repeat')
        extra_kwargs = {
            'name': {'required': True},
            'surname': {'required': True},
            'patronym': {'required': False},
        }
    
    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs['password'] != attrs['password_repeat']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
    
    def validate_email(self, value):
        """Validate that email is unique (excluding deleted users)."""
        if User.objects.all_with_deleted().filter(email=value, account_status='active').exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
    
    def create(self, validated_data):
        """Create a new user."""
        validated_data.pop('password_repeat')
        
        # Get default 'user' role
        user_role = Role.objects.filter(name='user').first()
        if not user_role:
            raise serializers.ValidationError("Default 'user' role does not exist. Please run migrations and create_dummy_data.")
        
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            name=validated_data['name'],
            surname=validated_data['surname'],
            patronym=validated_data.get('patronym', ''),
            role=user_role
        )
        return user


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login with session metadata."""
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    screen_size = serializers.CharField(required=False, allow_blank=True)
    timezone = serializers.CharField(required=False, allow_blank=True, default='UTC')
    language = serializers.CharField(required=False, allow_blank=True, default='en-US')
    extra_metadata = serializers.JSONField(required=False, default=dict)
    
    def validate(self, attrs):
        """Validate user credentials."""
        email = attrs.get('email')
        password = attrs.get('password')
        
        if not email or not password:
            raise serializers.ValidationError({"error": "Must include 'email' and 'password'."})
        
        # Check for admin login
        BASE_DIR = Path(__file__).resolve().parent.parent.parent
        SETTINGS_YAML_PATH = BASE_DIR / 'settings.yaml'
        try:
            with open(SETTINGS_YAML_PATH, 'r') as f:
                config = yaml.safe_load(f)
            admin_password = config.get('admin', {}).get('password', '')
            admin_email = 'admin@taskboard.local'
        except Exception:
            admin_password = ''
            admin_email = 'admin@taskboard.local'
        
        # Try admin login first
        if email == admin_email and password == admin_password:
            try:
                # Use all_with_deleted to get admin even if account_status is not active
                admin_user = User.objects.all_with_deleted().get(email=admin_email)
                if admin_user.account_status == 'active':
                    attrs['user'] = admin_user
                    return attrs
                else:
                    raise serializers.ValidationError({"error": "This account is not active."})
            except User.DoesNotExist:
                raise serializers.ValidationError({"error": "Admin account does not exist. Please run 'python manage.py create_dummy_data' to create it."})
        
        # Regular user authentication
        try:
            user = User.objects.all_with_deleted().get(email=email)
            
            # Check account status first
            if user.account_status == 'deleted':
                raise serializers.ValidationError({"error": "This account has been deleted."})
            if user.account_status == 'banned':
                raise serializers.ValidationError({"error": "This account has been banned."})
            if user.account_status != 'active':
                raise serializers.ValidationError({"error": "This account is not active."})
            
            # Try Django's authenticate first
            authenticated_user = authenticate(request=self.context.get('request'), username=email, password=password)
            
            # If authenticate fails, try manual password check
            # This handles cases where is_active might be False but account_status is active
            if not authenticated_user:
                # Check password manually
                if user.check_password(password):
                    # Password is correct, use this user
                    authenticated_user = user
                else:
                    # Password is incorrect
                    raise serializers.ValidationError({"error": "Invalid email or password."})
            
            # Ensure we're using the authenticated user
            if authenticated_user.account_status != 'active':
                raise serializers.ValidationError({"error": "This account is not active."})
            
            attrs['user'] = authenticated_user
            return attrs
            
        except User.DoesNotExist:
            raise serializers.ValidationError({"error": "Invalid email or password."})


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile."""
    role_name = serializers.CharField(source='role.name', read_only=True)
    full_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'surname', 'patronym', 'full_name', 'role_name', 
                  'birth_date', 'birth_place', 'account_status', 'is_active', 'date_joined', 'last_login')
        read_only_fields = ('id', 'email', 'role_name', 'account_status', 'date_joined', 'last_login')
    
    def update(self, instance, validated_data):
        """Update user profile."""
        # Update full_name will be handled by model's save method
        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user listing and role management."""
    full_name = serializers.CharField(read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'surname', 'patronym', 'full_name', 'role_name', 
                  'is_active', 'account_status', 'date_joined')
        read_only_fields = ('id', 'email', 'name', 'surname', 'patronym', 'full_name', 
                           'role_name', 'is_active', 'account_status', 'date_joined')


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change."""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password_repeat = serializers.CharField(required=True, write_only=True)
    
    def validate(self, attrs):
        """Validate that new passwords match."""
        if attrs['new_password'] != attrs['new_password_repeat']:
            raise serializers.ValidationError({"new_password": "New password fields didn't match."})
        return attrs
    
    def validate_old_password(self, value):
        """Validate that old password is correct."""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class ChangeEmailSerializer(serializers.Serializer):
    """Serializer for email change."""
    new_email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    
    def validate_new_email(self, value):
        """Validate that new email is unique (excluding deleted users)."""
        user = self.context['request'].user
        # Normalize email
        value = User.objects.normalize_email(value)
        
        # Check if email is already taken by another active user
        if User.objects.all_with_deleted().filter(email=value, account_status='active').exclude(id=user.id).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        
        # Check if user is trying to set the same email
        if value == user.email:
            raise serializers.ValidationError("New email must be different from current email.")
        
        return value
    
    def validate_password(self, value):
        """Validate that password is correct."""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Password is incorrect.")
        return value
