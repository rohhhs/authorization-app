#!/bin/bash

# Database setup script for Django taskboard application
# This script configures PostgreSQL, generates a secure password, and updates settings.yaml

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SETTINGS_YAML="$PROJECT_ROOT/settings.yaml"

echo "=== Database Setup Script ==="
echo ""

# Check if running as root (for sudo commands)
if [ "$EUID" -ne 0 ]; then 
    echo "This script requires sudo privileges for PostgreSQL operations."
    echo "Please run with: sudo bash $0"
    exit 1
fi

# Function to generate secure password
generate_password() {
    # Generate a 20-character password with alphanumeric and special characters
    openssl rand -base64 24 | tr -d "=+/" | cut -c1-20
}

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "ERROR: PostgreSQL is not installed."
    echo "Please install PostgreSQL first:"
    echo "  sudo apt update"
    echo "  sudo apt install -y postgresql postgresql-contrib"
    exit 1
fi

# Check PostgreSQL service status
echo "Checking PostgreSQL service status..."
if systemctl is-active --quiet postgresql; then
    echo "✓ PostgreSQL service is running"
else
    echo "Starting PostgreSQL service..."
    systemctl start postgresql
    systemctl enable postgresql
    echo "✓ PostgreSQL service started"
fi

# Generate secure password
echo ""
echo "Generating secure password for PostgreSQL..."
DB_PASSWORD=$(generate_password)
echo "✓ Password generated"

# Set PostgreSQL password
echo ""
echo "Setting PostgreSQL password for 'postgres' user..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
    echo "Warning: Could not set password. PostgreSQL may be using peer authentication."
    echo "Attempting alternative method..."
    # Try with environment variable
    PGPASSWORD='' sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';" || {
        echo "ERROR: Failed to set PostgreSQL password."
        echo "You may need to configure PostgreSQL authentication manually."
        exit 1
    }
}
echo "✓ PostgreSQL password set"

# Create database if it doesn't exist
echo ""
echo "Creating database 'taskboard_db' if it doesn't exist..."
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='taskboard_db'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE taskboard_db;"
echo "✓ Database 'taskboard_db' ready"

# Configure database settings
echo ""
echo "Configuring database settings..."
sudo -u postgres psql -d taskboard_db -c "ALTER ROLE postgres SET client_encoding TO 'utf8';" 2>/dev/null || true
sudo -u postgres psql -d taskboard_db -c "ALTER ROLE postgres SET default_transaction_isolation TO 'read committed';" 2>/dev/null || true
sudo -u postgres psql -d taskboard_db -c "ALTER ROLE postgres SET timezone TO 'UTC';" 2>/dev/null || true
echo "✓ Database settings configured"

# Update settings.yaml
echo ""
echo "Updating settings.yaml with generated password..."
if [ -f "$SETTINGS_YAML" ]; then
    # Use Python to safely update YAML file
    python3 << EOF
import yaml
import sys

settings_path = "$SETTINGS_YAML"
new_password = "$DB_PASSWORD"

try:
    with open(settings_path, 'r') as f:
        config = yaml.safe_load(f) or {}
    
    if 'database' not in config:
        config['database'] = {}
    
    config['database']['password'] = new_password
    
    with open(settings_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
    
    print(f"✓ Updated settings.yaml with new password")
except Exception as e:
    print(f"ERROR: Failed to update settings.yaml: {e}")
    sys.exit(1)
EOF
else
    echo "ERROR: settings.yaml not found at $SETTINGS_YAML"
    exit 1
fi

# Configure ufw firewall
echo ""
echo "Configuring ufw firewall..."
if command -v ufw &> /dev/null; then
    # Check if ufw is active
    if ufw status | grep -q "Status: active"; then
        echo "ufw is active, allowing PostgreSQL port 5432..."
        ufw allow 5432/tcp > /dev/null 2>&1 || true
        echo "✓ PostgreSQL port 5432 allowed in ufw"
    else
        echo "ufw is not active, skipping firewall configuration"
    fi
else
    echo "ufw is not installed, skipping firewall configuration"
fi

# Test database connection
echo ""
echo "Testing database connection..."
if sudo -u postgres psql -d taskboard_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ Database connection successful"
else
    echo "WARNING: Could not verify database connection"
fi

echo ""
echo "=== Database Setup Complete ==="
echo ""
echo "Database configuration:"
echo "  Database: taskboard_db"
echo "  User: postgres"
echo "  Password: $DB_PASSWORD"
echo "  Host: localhost"
echo "  Port: 5432"
echo ""
echo "Next steps:"
echo "  1. Run migrations: cd api && python manage.py makemigrations && python manage.py migrate"
echo "  2. Create dummy data: cd api && python manage.py create_dummy_data"
echo "  3. Start server: cd api && python manage.py runserver 8001"
echo ""
