"""
URL configuration for taskboard project.
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('register/', TemplateView.as_view(template_name='accounts/register.html'), name='register'),
    path('login/', TemplateView.as_view(template_name='accounts/login.html'), name='login'),
    path('profile/index.html', TemplateView.as_view(template_name='profile/index.html'), name='profile'),
    path('task/index.html', TemplateView.as_view(template_name='task/index.html'), name='task-list'),
    path('api/accounts/', include('accounts.urls')),
    path('api/tasks/', include('tasks.urls')),
    path('api/users/', include('tasks.user_urls')),  # User management endpoints
    # Swagger UI
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

# Serve static and media files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
