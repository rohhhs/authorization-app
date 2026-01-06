from django.urls import path
from .views import (
    RegisterView,
    login_view,
    logout_view,
    refresh_token_view,
    ProfileView,
    delete_account_view,
    change_password_view,
    change_email_view,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('token/refresh/', refresh_token_view, name='refresh_token'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('delete/', delete_account_view, name='delete_account'),
    path('change-password/', change_password_view, name='change_password'),
    path('change-email/', change_email_view, name='change_email'),
]
