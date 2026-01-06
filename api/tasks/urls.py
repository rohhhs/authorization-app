from django.urls import path
from .views import (
    TaskListCreateView,
    TaskDetailView,
    TaskDeleteView,
    PublicTaskListView,
)

urlpatterns = [
    # Task endpoints
    path('', TaskListCreateView.as_view(), name='task-list-create'),
    path('public/', PublicTaskListView.as_view(), name='public-task-list'),
    path('<int:pk>/', TaskDetailView.as_view(), name='task-detail'),
    path('<int:pk>/delete/', TaskDeleteView.as_view(), name='task-delete'),
]
