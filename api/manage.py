#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
from pathlib import Path


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'taskboard.settings')
    
    # If runserver command is used without a port, read port from settings.yaml
    if len(sys.argv) >= 2 and sys.argv[1] == 'runserver':
        # Check if port is already specified in command line arguments
        port_specified = False
        for arg in sys.argv[2:]:
            if ':' in arg or arg.isdigit():
                port_specified = True
                break
        
        # If no port specified, read from settings.yaml
        if not port_specified:
            try:
                import yaml
                BASE_DIR = Path(__file__).resolve().parent.parent
                SETTINGS_YAML_PATH = BASE_DIR / 'settings.yaml'
                if SETTINGS_YAML_PATH.exists():
                    with open(SETTINGS_YAML_PATH, 'r') as f:
                        config = yaml.safe_load(f)
                    port = config.get('server', {}).get('port', 8000)
                    # Add port to sys.argv if not already present
                    sys.argv.append(str(port))
            except Exception:
                # If reading settings.yaml fails, use default port 8000
                pass
    
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
