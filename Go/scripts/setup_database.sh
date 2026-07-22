#!/bin/bash
# Smart CA PostgreSQL Database Setup (Unix/Linux/Mac)
# Non-interactive: export POSTGRES_PASSWORD=... before running.
#
# Prefer Docker for zero local DB setup:
#   docker compose up --build
#
# Creates app credentials aligned with /.env.example and Go/.env.example:
#   smartca / smartca / smartca

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "========================================"
echo "Smart CA Database Setup"
echo "========================================"
echo ""

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "ERROR: Set POSTGRES_PASSWORD to the postgres superuser password (non-interactive)."
  echo "Example: POSTGRES_PASSWORD='...' ./setup_database.sh"
  echo "Or use Docker: docker compose up --build"
  exit 1
fi

export PGPASSWORD="$POSTGRES_PASSWORD"

echo "Running database setup..."
psql -U postgres -h localhost -f "${SCRIPT_DIR}/setup_database.sql"

echo ""
echo "Database setup completed successfully!"
echo "Database: smartca"
echo "User:     smartca"
echo "Password: smartca"
echo ""
echo "Next: cp Go/.env.example Go/.env && cd Go && go run ./cmd/api"
