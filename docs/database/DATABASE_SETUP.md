# PostgreSQL Database Setup Guide

## Prerequisites

- PostgreSQL 12 or higher installed on your system
- Access to PostgreSQL command line or pgAdmin

## Installation

### Windows

1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Default port is `5432`

### Linux

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS

```bash
brew install postgresql
brew services start postgresql
```

## Database Setup

### Step 1: Create Database and User

Connect to PostgreSQL as the postgres user:

```bash
# Windows (PowerShell)
psql -U postgres

# Linux/macOS
sudo -u postgres psql
```

Then run the following SQL commands:

```sql
-- Create database
CREATE DATABASE smartca;

-- Create user
CREATE USER smartca WITH ENCRYPTED PASSWORD 'smartca123';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE smartca TO smartca;

-- Connect to the database
\c smartca

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO smartca;

-- Exit psql
\q
```

### Step 2: Configure Environment Variables

Update the `.env` file in the `Go/` directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=smartca
DB_PASSWORD=smartca123
DB_NAME=smartca
DB_SSLMODE=disable
```

**Important:** Never commit the `.env` file to version control!

### Step 3: Run the Application

The application will automatically:
1. Connect to the PostgreSQL database
2. Run migrations to create all tables
3. Load seed data if the database is empty

```bash
cd Go
./smartca.exe
```

## Verification

### Check Database Connection

```bash
psql -U smartca -d smartca -h localhost
```

### View Tables

```sql
\dt
```

You should see tables like:
- users
- roles
- permissions
- clients
- companies
- invoices
- invoice_items
- payments
- documents
- and more...

### View Sample Data

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM clients;
SELECT COUNT(*) FROM invoices;
```

## Troubleshooting

### Connection Refused

If you get a "connection refused" error:

1. Check if PostgreSQL is running:
   ```bash
   # Windows
   Get-Service postgresql*
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Check if PostgreSQL is listening on the correct port:
   ```bash
   netstat -an | findstr 5432  # Windows
   sudo netstat -plnt | grep 5432  # Linux
   ```

### Authentication Failed

If you get an "authentication failed" error:

1. Check your `.env` file credentials
2. Verify the user exists in PostgreSQL
3. Check `pg_hba.conf` file (usually in PostgreSQL data directory)
4. Ensure it has a line like: `host all all 127.0.0.1/32 md5`

### Permission Denied

If you get "permission denied" errors:

```sql
-- Connect as postgres user
\c smartca postgres

-- Grant all privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smartca;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smartca;
```

## Migration Management

### View Applied Migrations

```sql
SELECT * FROM schema_migrations ORDER BY applied_at DESC;
```

### Manual Migration

If you need to manually run migrations:

```bash
cd Go
psql -U smartca -d smartca -f migrations/001_initial_schema.up.sql
```

## Backup and Restore

### Backup

```bash
pg_dump -U smartca -d smartca -F c -f smartca_backup.dump
```

### Restore

```bash
pg_restore -U smartca -d smartca -c smartca_backup.dump
```

## Production Considerations

### Security

1. Use strong passwords
2. Enable SSL/TLS (`DB_SSLMODE=require`)
3. Restrict network access
4. Use connection pooling (already configured in the app)

### Performance

1. Adjust `DB_MAX_OPEN_CONNS` and `DB_MAX_IDLE_CONNS` in `.env`
2. Monitor slow queries
3. Add indexes as needed
4. Regular VACUUM and ANALYZE

### Monitoring

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('smartca'));

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'smartca';
```

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [pgAdmin](https://www.pgadmin.org/) - GUI tool for PostgreSQL management
