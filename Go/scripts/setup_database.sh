#!/bin/bash
# Smart CA PostgreSQL Database Setup Script for Unix/Linux/Mac
# This script creates the smartca database and user
#
# Prerequisites:
# 1. PostgreSQL must be installed
# 2. You need the postgres superuser password
#
# Usage: ./setup_database.sh

echo "========================================"
echo "Smart CA Database Setup"
echo "========================================"
echo ""
echo "This script will:"
echo "1. Create the 'smartca' database"
echo "2. Create the 'smartca' user"
echo "3. Grant necessary privileges"
echo ""
echo "You will be prompted for the postgres superuser password."
echo ""
read -p "Press Enter to continue..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the setup SQL script
echo ""
echo "Running database setup..."
psql -U postgres -h localhost -f "${SCRIPT_DIR}/setup_database.sql"

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "Database setup completed successfully!"
    echo "========================================"
    echo ""
    echo "Database: smartca"
    echo "User: smartca"
    echo "Password: yourpassword"
    echo ""
    echo "You can now run the Go application."
else
    echo ""
    echo "========================================"
    echo "Database setup failed!"
    echo "========================================"
    echo ""
    echo "Please check the error messages above."
    exit 1
fi
