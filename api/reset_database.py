#!/usr/bin/env python3
"""
Script to drop all tables and reset the database for fresh migrations.
Run this before running migrations for the first time.
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'taskboard.settings')
django.setup()

from django.db import connection

def reset_database():
    """Drop all tables in the database."""
    with connection.cursor() as cursor:
        # Disable foreign key checks temporarily
        cursor.execute("SET session_replication_role = 'replica';")
        
        # Get all table names
        cursor.execute("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        """)
        tables = [row[0] for row in cursor.fetchall()]
        
        # Drop all tables
        for table in tables:
            try:
                cursor.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE;')
                print(f'Dropped table: {table}')
            except Exception as e:
                print(f'Error dropping {table}: {e}')
        
        # Re-enable foreign key checks
        cursor.execute("SET session_replication_role = 'origin';")
        
        print('\nDatabase reset complete!')
        print('Now run: python3 manage.py migrate')

if __name__ == '__main__':
    confirm = input('This will DROP ALL TABLES. Are you sure? (yes/no): ')
    if confirm.lower() == 'yes':
        reset_database()
    else:
        print('Cancelled.')
