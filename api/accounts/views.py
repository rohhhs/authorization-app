from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from .models import User, UserSession
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    ChangePasswordSerializer,
    ChangeEmailSerializer,
)


def get_client_ip(request):
    """Extract client IP address from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def set_jwt_cookies(response, access_token, refresh_token):
    """Set JWT tokens as HTTP-only cookies with expiration timestamp.
    Returns expires_at timestamp for inclusion in response body."""
    http_only = getattr(settings, 'JWT_COOKIE_HTTPONLY', True)
    secure = getattr(settings, 'JWT_COOKIE_SECURE', False)
    same_site = getattr(settings, 'JWT_COOKIE_SAMESITE', 'Lax')
    cookie_name = getattr(settings, 'JWT_COOKIE_NAME', 'access_token')
    
    # Clear existing cookies first to prevent duplicates
    response.delete_cookie(cookie_name, path='/')
    response.delete_cookie('access_token_expires_at', path='/')
    response.delete_cookie('refresh_token', path='/')
    
    # Decode JWT to get expiration time
    try:
        # Simple JWT tokens are base64 encoded, decode to get expiration
        # Format: header.payload.signature
        import base64
        import json
        
        parts = access_token.split('.')
        if len(parts) >= 2:
            # Decode payload (second part)
            payload = parts[1]
            # Add padding if needed
            payload += '=' * (4 - len(payload) % 4)
            decoded_payload = base64.urlsafe_b64decode(payload)
            token_data = json.loads(decoded_payload)
            
            exp_timestamp = token_data.get('exp')
            if exp_timestamp:
                # Convert to datetime and then to ISO format string in UTC
                from datetime import datetime
                exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
                # Ensure UTC format: YYYY-MM-DDTHH:MM:SS+00:00
                expires_at = exp_datetime.isoformat()
                # Calculate max_age in seconds (using UTC timestamps)
                max_age = int(exp_timestamp - timezone.now().timestamp())
            else:
                # Fallback to default - use UTC explicitly
                max_age = getattr(settings, 'JWT_COOKIE_MAX_AGE', 3600)
                # Use UTC timezone explicitly
                expires_at_dt = timezone.now().astimezone(timezone.utc) + timedelta(seconds=max_age)
                expires_at = expires_at_dt.isoformat()
        else:
            # Fallback if token format is wrong - use UTC explicitly
            max_age = getattr(settings, 'JWT_COOKIE_MAX_AGE', 3600)
            expires_at_dt = timezone.now().astimezone(timezone.utc) + timedelta(seconds=max_age)
            expires_at = expires_at_dt.isoformat()
    except Exception:
        # Fallback if decoding fails - use UTC explicitly
        max_age = getattr(settings, 'JWT_COOKIE_MAX_AGE', 3600)
        expires_at_dt = timezone.now().astimezone(timezone.utc) + timedelta(seconds=max_age)
        expires_at = expires_at_dt.isoformat()
    
    # Set access_token cookie (token value only, not "Bearer {token}")
    response.set_cookie(
        cookie_name,
        access_token,  # Store token value only
        max_age=max_age,
        httponly=http_only,
        secure=secure,
        samesite=same_site,
        path='/'
    )
    
    # Set expiration timestamp cookie
    response.set_cookie(
        'access_token_expires_at',
        expires_at,
        max_age=max_age,
        httponly=http_only,
        secure=secure,
        samesite=same_site,
        path='/'
    )
    
    # Calculate refresh token max_age
    refresh_lifetime = getattr(settings, 'SIMPLE_JWT', {}).get('REFRESH_TOKEN_LIFETIME')
    if refresh_lifetime and hasattr(refresh_lifetime, 'total_seconds'):
        refresh_max_age = int(refresh_lifetime.total_seconds())
    else:
        refresh_max_age = 86400  # Default 24 hours
    
    response.set_cookie(
        'refresh_token',
        refresh_token,
        max_age=refresh_max_age,
        httponly=http_only,
        secure=secure,
        samesite=same_site,
        path='/'
    )
    
    return expires_at


def clear_jwt_cookies(response):
    """Clear JWT token cookies."""
    cookie_name = getattr(settings, 'JWT_COOKIE_NAME', 'access_token')
    response.delete_cookie(cookie_name, path='/')
    response.delete_cookie('access_token_expires_at', path='/')
    response.delete_cookie('refresh_token', path='/')
    return response


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            # Format errors for better frontend handling
            errors = {}
            for field, messages in serializer.errors.items():
                if isinstance(messages, list):
                    errors[field] = messages[0] if messages else 'Invalid value'
                else:
                    errors[field] = str(messages)
            return Response(
                {'error': errors.get('non_field_errors', errors) if 'non_field_errors' in errors else errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        user = serializer.save()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        # Set user as active (logged in after registration)
        user.is_active = True
        user.save()
        
        # Get expires_at by setting cookies on a temporary response
        expires_at = set_jwt_cookies(Response(), access_token, refresh_token)
        
        # Create response with tokens in body
        response = Response({
            'user': UserProfileSerializer(user).data,
            'message': 'User registered successfully',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_at': expires_at,
            'email': user.email
        }, status=status.HTTP_201_CREATED)
        
        # Set JWT cookies on the actual response
        set_jwt_cookies(response, access_token, refresh_token)
        
        return response


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """User login endpoint with session tracking."""
    serializer = UserLoginSerializer(data=request.data, context={'request': request})
    if not serializer.is_valid():
        return Response(
            {'error': serializer.errors.get('error', ['Invalid credentials'])[0] if isinstance(serializer.errors.get('error'), list) else serializer.errors.get('error', 'Invalid credentials')},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = serializer.validated_data['user']
    
    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)
    
    # Update last login and set active
    user.last_login = timezone.now()
    user.is_active = True
    user.save()
    
    # Extract session metadata
    ip_address = get_client_ip(request)
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    screen_size = serializer.validated_data.get('screen_size', '')
    timezone_str = serializer.validated_data.get('timezone', 'UTC')
    language = serializer.validated_data.get('language', 'en-US')
    extra_metadata = serializer.validated_data.get('extra_metadata', {})
    
    # Get connection number (count existing sessions for this user)
    connection_number = UserSession.objects.filter(user=user).count() + 1
    
    # Create user session record
    UserSession.objects.create(
        user=user,
        ip_address=ip_address,
        user_agent=user_agent,
        screen_size=screen_size,
        timezone=timezone_str,
        language=language,
        connection_number=connection_number,
        extra_metadata=extra_metadata
    )
    
    # Get expires_at by setting cookies on a temporary response
    expires_at = set_jwt_cookies(Response(), access_token, refresh_token)
    
    # Create response with tokens in body
    response = Response({
        'user': UserProfileSerializer(user).data,
        'message': 'Login successful',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'expires_at': expires_at,
        'email': user.email
    }, status=status.HTTP_200_OK)
    
    # Set JWT cookies on the actual response
    set_jwt_cookies(response, access_token, refresh_token)
    
    return response


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def refresh_token_view(request):
    """Refresh access token using refresh token."""
    refresh_token = request.data.get('refresh_token') or request.COOKIES.get('refresh_token')
    
    if not refresh_token:
        return Response(
            {'error': 'Refresh token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Create RefreshToken instance and get new access token
        refresh = RefreshToken(refresh_token)
        access_token = str(refresh.access_token)
        new_refresh_token = str(refresh)
        
        # Get user from token
        user_id = refresh.get('user_id')
        user = User.objects.get(id=user_id)
        
        # Get expires_at by setting cookies on a temporary response
        expires_at = set_jwt_cookies(Response(), access_token, new_refresh_token)
        
        # Create response with new tokens
        response = Response({
            'access_token': access_token,
            'refresh_token': new_refresh_token,
            'expires_at': expires_at,
            'email': user.email,
            'message': 'Token refreshed successfully'
        }, status=status.HTTP_200_OK)
        
        # Set JWT cookies on the actual response
        set_jwt_cookies(response, access_token, new_refresh_token)
        
        return response
    except Exception as e:
        return Response(
            {'error': 'Invalid or expired refresh token', 'detail': str(e)},
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """User logout endpoint."""
    user = request.user
    
    # Get the most recent session for this user and mark it as inactive (delete it)
    # In a real scenario, you might want to keep session history, but for now we'll delete
    UserSession.objects.filter(user=user).order_by('-created_at').first()
    # Delete all active sessions for this user
    UserSession.objects.filter(user=user).delete()
    
    # Try to blacklist refresh token if provided
    try:
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
    except Exception:
        pass
    
    # Set is_active to False
    user.is_active = False
    user.save()
    
    # Create response
    response = Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
    
    # Clear JWT cookies
    clear_jwt_cookies(response)
    
    return response


class ProfileView(generics.RetrieveUpdateAPIView):
    """User profile view and update."""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response({
            'user': serializer.data,
            'message': 'Profile updated successfully'
        })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def delete_account_view(request):
    """Soft delete user account."""
    user = request.user
    user.soft_delete()
    
    # Clear sessions
    UserSession.objects.filter(user=user).delete()
    
    # Create response
    response = Response({'message': 'Account deleted successfully'}, status=status.HTTP_200_OK)
    
    # Clear JWT cookies
    clear_jwt_cookies(response)
    
    return response


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password_view(request):
    """Change user password."""
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    
    if not serializer.is_valid():
        errors = {}
        for field, messages in serializer.errors.items():
            if isinstance(messages, list):
                errors[field] = messages[0] if messages else 'Invalid value'
            else:
                errors[field] = str(messages)
        return Response(
            {'error': errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = request.user
    user.set_password(serializer.validated_data['new_password'])
    user.save()
    
    return Response({'message': 'Password changed successfully'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_email_view(request):
    """Change user email address."""
    serializer = ChangeEmailSerializer(data=request.data, context={'request': request})
    
    if not serializer.is_valid():
        errors = {}
        for field, messages in serializer.errors.items():
            if isinstance(messages, list):
                errors[field] = messages[0] if messages else 'Invalid value'
            else:
                errors[field] = str(messages)
        return Response(
            {'error': errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = request.user
    old_email = user.email
    new_email = serializer.validated_data['new_email']
    
    # Update email
    user.email = new_email
    user.save()
    
    return Response({
        'message': 'Email changed successfully',
        'old_email': old_email,
        'new_email': new_email
    }, status=status.HTTP_200_OK)
