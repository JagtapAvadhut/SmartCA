# Smart CA Database Setup Guide

This guide will help you set up the PostgreSQL database for Smart CA.

## Prerequisites

1. **PostgreSQL 12+** installed on your system
2. PostgreSQL service running
3. Access to the `postgres` superuser account

## Quick Setup (Windows)

### Option 1: Using the Batch Script (Recommended)

1. Open Command Prompt or PowerShell as Administrator
2. Navigate to the scripts directory:
   ```cmd
   cd D:\SmartCA\Go\scripts
   ```
3. Run the setup script:
   ```cmd
   setup_database.bat
   ```
4. Enter the `postgres` superuser password when prompted

### Option 2: Manual Setup

If you don't know the postgres password or prefer manual setup:

1. Open pgAdmin or another PostgreSQL client
2. Connect as the `postgres` superuser
3. Run the SQL commands from `setup_database.sql`

## Quick Setup (Linux/Mac)

1. Open Terminal
2. Navigate to the scripts directory:
   ```bash
   cd /path/to/SmartCA/Go/scripts
   ```
3. Run the setup script:
   ```bash
   ./setup_database.sh
   ```
4. Enter the `postgres` superuser password when prompted

## Manual Setup (All Platforms)

If the automated scripts don't work, you can set up the database manually:

### 1. Connect to PostgreSQL

```bash
# Windows
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost

# Linux/Mac
psql -U postgres -h localhost
```

### 2. Create Database and User

```sql
-- Create database
DROP DATABASE IF EXISTS smartca;
CREATE DATABASE smartca;

-- Create user
DROP USER IF EXISTS smartca;
CREATE USER smartca WITH PASSWORD 'yourpassword';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE smartca TO smartca;
```

### 3. Connect to smartca Database

```sql
\c smartca
```

### 4. Grant Schema Privileges

```sql
GRANT ALL ON SCHEMA public TO smartca;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smartca;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smartca;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO smartca;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO smartca;
```

### 5. Verify

```sql
SELECT current_database(), current_user;
```

You should see:
```
 current_database | current_user 
------------------+--------------
 smartca          | postgres
```

## Verify the Setup

After running the setup, verify the database is accessible:

```bash
# Windows
set PGPASSWORD=yourpassword
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U smartca -h localhost -d smartca -c "SELECT current_database();"

# Linux/Mac
PGPASSWORD=yourpassword psql -U smartca -h localhost -d smartca -c "SELECT current_database();"
```

## Configuration

After database setup, ensure your `.env` file has the correct credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=smartca
DB_PASSWORD=yourpassword
DB_NAME=smartca
DB_SSLMODE=disable
```

## Running Migrations

The Go application will automatically run migrations on startup. You can also run them manually:

```bash
cd Go
go run cmd/api/main.go
```

The migrations will:
- Create all required tables
- Set up indexes and foreign keys
- Load seed data (if database is empty)

## Troubleshooting

### "password authentication failed"

- Double-check the postgres password
- Try resetting the postgres password:
  - Windows: Use Stack Builder or reinstall PostgreSQL
  - Linux: `sudo -u postgres psql` and run `ALTER USER postgres PASSWORD 'newpassword';`

### "connection refused"

- Ensure PostgreSQL service is running:
  - Windows: Check Services app for "postgresql-x64-18"
  - Linux: `sudo systemctl status postgresql`

### "database already exists"

- The setup script will drop and recreate the database
- If you want to keep existing data, skip the DROP commands

### Permission denied on schema public

Run these commands as superuser:

```sql
\c smartca
GRANT ALL ON SCHEMA public TO smartca;
ALTER DATABASE smartca OWNER TO smartca;
```

## Security Notes

1. **Change the default password** in production!
2. Update `.env` with a strong password
3. Never commit `.env` to version control
4. Use `sslmode=require` in production
5. Consider using environment-specific users (dev, staging, prod)

## Next Steps

After database setup:

1. Start the Go server: `cd Go && go run cmd/api/main.go`
2. The server will automatically run migrations
3. Check the logs for "Database connected successfully"
4. Access the API at http://localhost:8080

## Support

For issues:
- Check PostgreSQL logs
- Check Go application logs
- Verify `.env` configuration
- Ensure PostgreSQL service is running
