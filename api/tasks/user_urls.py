from django.urls import path
from .views import (
    user_list_view,
    promote_user_view,
    demote_user_view,
)

urlpatterns = [
    path('', user_list_view, name='user-list'),
    path('<int:user_id>/promote/', promote_user_view, name='promote-user'),
    path('<int:user_id>/demote/', demote_user_view, name='demote-user'),
]
