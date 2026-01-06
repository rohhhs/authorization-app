"""
Middleware to update UserSession last_activity_at on authenticated requests.
"""
from django.utils import timezone
from .models import UserSession


class UpdateSessionActivityMiddleware:
    """Middleware to update session activity timestamp."""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Process request
        response = self.get_response(request)
        
        # Update session activity if user is authenticated
        if request.user.is_authenticated:
            # Get the most recent session for this user
            session = UserSession.objects.filter(user=request.user).order_by('-created_at').first()
            if session:
                # Update last_activity_at (this will trigger auto_now=True)
                UserSession.objects.filter(id=session.id).update(last_activity_at=timezone.now())
        
        return response
