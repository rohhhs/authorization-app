"""
Django management command to create dummy data for development and testing.
Creates roles, permissions, users with different roles and sample tasks.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date, timedelta
from tasks.models import UserTask
from accounts.models import Role, Permission, RolePermission
import yaml
from pathlib import Path
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates roles, permissions, dummy users and tasks for development and testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing dummy data before creating new data',
        )

    def handle(self, *args, **options):
        # Load settings from settings.yaml
        BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
        SETTINGS_YAML_PATH = BASE_DIR / 'settings.yaml'
        
        try:
            with open(SETTINGS_YAML_PATH, 'r') as f:
                config = yaml.safe_load(f)
            admin_password = config.get('admin', {}).get('password', 'admin123')
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f'Could not load settings.yaml: {e}')
            )
            admin_password = 'admin123'

        if options['clear']:
            self.stdout.write('Clearing existing dummy data...')
            # Delete dummy users (identified by @taskboard.local email domain)
            User.objects.filter(email__endswith='@taskboard.local').delete()
            UserTask.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Cleared existing dummy data'))

        self.stdout.write('Creating roles and permissions...')
        
        # Create Roles
        admin_role, _ = Role.objects.get_or_create(
            name='administrator',
            defaults={'description': 'Full system access and control'}
        )
        moderator_role, _ = Role.objects.get_or_create(
            name='moderator',
            defaults={'description': 'Can manage user tasks and moderate content'}
        )
        user_role, _ = Role.objects.get_or_create(
            name='user',
            defaults={'description': 'Regular user with basic access'}
        )
        
        self.stdout.write(self.style.SUCCESS('✓ Created roles'))

        # Create Permissions
        permissions_data = [
            ('task_create', 'Create new tasks'),
            ('task_delete_own', 'Delete own tasks'),
            ('task_delete_any', 'Delete any user task'),
            ('task_update_own', 'Update own tasks'),
            ('task_update_any', 'Update any user task'),
            ('user_rank_change', 'Change user roles and ranks'),
            ('user_ban', 'Ban users'),
            ('user_delete', 'Delete user accounts'),
        ]
        
        permissions = {}
        for codename, description in permissions_data:
            perm, _ = Permission.objects.get_or_create(
                codename=codename,
                defaults={'description': description}
            )
            permissions[codename] = perm
        
        self.stdout.write(self.style.SUCCESS('✓ Created permissions'))

        # Link Roles to Permissions
        # Administrator gets all permissions
        for perm in permissions.values():
            RolePermission.objects.get_or_create(role=admin_role, permission=perm)
        
        # Moderator permissions
        moderator_perms = ['task_create', 'task_delete_any', 'task_update_any', 'task_delete_own', 'task_update_own']
        for perm_codename in moderator_perms:
            if perm_codename in permissions:
                RolePermission.objects.get_or_create(role=moderator_role, permission=permissions[perm_codename])
        
        # User permissions
        user_perms = ['task_create', 'task_delete_own', 'task_update_own']
        for perm_codename in user_perms:
            if perm_codename in permissions:
                RolePermission.objects.get_or_create(role=user_role, permission=permissions[perm_codename])
        
        self.stdout.write(self.style.SUCCESS('✓ Linked roles to permissions'))

        self.stdout.write('Creating dummy users...')

        # Create Administrator
        admin_email = 'admin@taskboard.local'
        admin, created = User.objects.get_or_create(
            email=admin_email,
            defaults={
                'name': 'Admin',
                'surname': 'User',
                'patronym': 'System',
                'role': admin_role,
                'birth_date': date(1990, 1, 1),
                'birth_place': 'System City',
                'is_staff': True,
                'is_superuser': True,
                'is_active': False,
                'account_status': 'active',
            }
        )
        if created:
            admin.set_password(admin_password)
            admin.save()
            self.stdout.write(
                self.style.SUCCESS(f'✓ Created administrator: {admin_email} (password: {admin_password})')
            )
        else:
            admin.role = admin_role
            admin.set_password(admin_password)
            admin.save()
            self.stdout.write(
                self.style.WARNING(f'✓ Administrator already exists: {admin_email} (password updated)')
            )

        # Create Moderators
        moderators_data = [
            {
                'email': 'moderator1@taskboard.local',
                'name': 'Moderator',
                'surname': 'One',
                'patronym': 'Test',
                'birth_date': date(1992, 5, 15),
                'birth_place': 'Moderator City',
            },
            {
                'email': 'moderator2@taskboard.local',
                'name': 'Moderator',
                'surname': 'Two',
                'patronym': 'Sample',
                'birth_date': date(1993, 8, 20),
                'birth_place': 'Sample Town',
            },
        ]

        moderator_password = 'moderator123'
        created_moderators = []
        for mod_data in moderators_data:
            moderator, created = User.objects.get_or_create(
                email=mod_data['email'],
                defaults={
                    'name': mod_data['name'],
                    'surname': mod_data['surname'],
                    'patronym': mod_data['patronym'],
                    'role': moderator_role,
                    'birth_date': mod_data['birth_date'],
                    'birth_place': mod_data['birth_place'],
                    'is_staff': True,  # Moderators have is_staff=True
                    'is_active': False,
                    'account_status': 'active',
                }
            )
            if created:
                moderator.set_password(moderator_password)
                moderator.save()
                created_moderators.append(moderator)
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created moderator: {mod_data["email"]} (password: {moderator_password})')
                )
            else:
                moderator.role = moderator_role
                moderator.set_password(moderator_password)
                moderator.save()
                created_moderators.append(moderator)
                self.stdout.write(
                    self.style.WARNING(f'✓ Moderator already exists: {mod_data["email"]} (password updated)')
                )

        # Create Regular Users
        users_data = [
            {
                'email': 'user1@taskboard.local',
                'name': 'John',
                'surname': 'Doe',
                'patronym': 'Smith',
                'birth_date': date(1995, 3, 10),
                'birth_place': 'User City',
            },
            {
                'email': 'user2@taskboard.local',
                'name': 'Jane',
                'surname': 'Smith',
                'patronym': 'Williams',
                'birth_date': date(1996, 7, 25),
                'birth_place': 'Another City',
            },
            {
                'email': 'user3@taskboard.local',
                'name': 'Bob',
                'surname': 'Johnson',
                'patronym': 'Brown',
                'birth_date': date(1994, 11, 5),
                'birth_place': 'Third City',
            },
        ]

        user_password = 'user123'
        created_users = []
        for user_data in users_data:
            user, created = User.objects.get_or_create(
                email=user_data['email'],
                defaults={
                    'name': user_data['name'],
                    'surname': user_data['surname'],
                    'patronym': user_data['patronym'],
                    'role': user_role,
                    'birth_date': user_data['birth_date'],
                    'birth_place': user_data['birth_place'],
                    'is_active': False,
                    'account_status': 'active',
                }
            )
            if created:
                user.set_password(user_password)
                user.save()
                created_users.append(user)
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created user: {user_data["email"]} (password: {user_password})')
                )
            else:
                user.role = user_role
                user.set_password(user_password)
                user.save()
                created_users.append(user)
                self.stdout.write(
                    self.style.WARNING(f'✓ User already exists: {user_data["email"]} (password updated)')
                )

        # Create tasks for all users
        all_users = [admin] + created_moderators + created_users
        
        task_templates = [
            {
                'title': 'Complete project documentation',
                'description': 'Write comprehensive documentation for the project including API endpoints and user guides.',
                'status': 'in_progress',
            },
            {
                'title': 'Review code changes',
                'description': 'Review pull requests and provide feedback on code quality and best practices.',
                'status': 'pending',
            },
            {
                'title': 'Update dependencies',
                'description': 'Check and update project dependencies to latest stable versions.',
                'status': 'pending',
            },
            {
                'title': 'Fix bug in authentication',
                'description': 'Investigate and fix the authentication bug reported in issue #42.',
                'status': 'in_progress',
            },
            {
                'title': 'Implement new feature',
                'description': 'Design and implement the new dashboard feature as discussed in the meeting.',
                'status': 'pending',
            },
            {
                'title': 'Write unit tests',
                'description': 'Add unit tests for the new API endpoints to ensure code coverage.',
                'status': 'done',
            },
        ]

        task_count = 0
        for user in all_users:
            # Assign 2-3 tasks per user
            user_tasks = random.sample(task_templates, min(3, len(task_templates)))
            
            for task_template in user_tasks:
                task, created = UserTask.objects.get_or_create(
                    title=task_template['title'],
                    user=user,
                    defaults={
                        'description': task_template['description'],
                        'status': task_template['status'],
                        'is_deleted': False,
                    }
                )
                if created:
                    task_count += 1
                    
                    # Create a subtask for some tasks
                    if random.random() > 0.5:
                        subtask, _ = UserTask.objects.get_or_create(
                            title=f'Subtask for {task_template["title"]}',
                            user=user,
                            parent=task,
                            defaults={
                                'description': f'This is a subtask of {task_template["title"]}',
                                'status': 'pending',
                                'is_deleted': False,
                            }
                        )
                        if _:
                            task_count += 1

        self.stdout.write(
            self.style.SUCCESS(f'✓ Created {task_count} tasks for users')
        )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== Dummy Data Creation Complete ==='))
        self.stdout.write('')
        self.stdout.write('Created users:')
        self.stdout.write(f'  Administrator: {admin_email} (password: {admin_password})')
        for mod in created_moderators:
            self.stdout.write(f'  Moderator: {mod.email} (password: {moderator_password})')
        for user in created_users:
            self.stdout.write(f'  User: {user.email} (password: {user_password})')
        self.stdout.write('')
        self.stdout.write(f'Total tasks created: {task_count}')
        self.stdout.write('')
