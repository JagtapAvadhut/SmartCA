# Smart CA - Quick Start Guide

This guide will help you get Smart CA up and running quickly with PostgreSQL.

## Prerequisites

- **Go 1.22+** installed
- **PostgreSQL 12+** installed and running
- **Node.js 18+** (for frontend)
- Access to PostgreSQL superuser account

## Step 1: Database Setup

### Windows

1. Open **PowerShell as Administrator**

2. Navigate to the project:
   ```powershell
   cd D:\SmartCA\Go\scripts
   ```

3. Run the setup script:
   ```powershell
   .\check_and_setup.ps1
   ```
   
   When prompted, enter your PostgreSQL `postgres` user password.

#### Alternative: Manual Setup

If you prefer manual setup or don't know the postgres password:

1. Open **pgAdmin 4**
2. Connect to your PostgreSQL server
3. Right-click on **Databases** → **Create** → **Database**
   - Name: `smartca`
   - Owner: postgres
4. Right-click on **Login/Group Roles** → **Create** → **Login/Group Role**
   - Name: `smartca`
   - Password: `yourpassword` (or your preferred password)
   - Privileges: Check "Can login"
5. Right-click on the `smartca` database → **Query Tool**
6. Run this SQL:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE smartca TO smartca;
   GRANT ALL ON SCHEMA public TO smartca;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO smartca;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO smartca;
   ```

### Linux/Mac

1. Open Terminal

2. Navigate to the project:
   ```bash
   cd /path/to/SmartCA/Go/scripts
   ```

3. Run the setup script:
   ```bash
   ./setup_database.sh
   ```

## Step 2: Configure Environment

1. Navigate to the Go directory:
   ```powershell
   cd D:\SmartCA\Go
   ```

2. Copy the environment template:
   ```powershell
   cp .env.example .env
   ```

3. Edit `.env` and update the database credentials if you changed the password:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=smartca
   DB_PASSWORD=yourpassword  # Change this if you used a different password
   DB_NAME=smartca
   DB_SSLMODE=disable
   ```

## Step 3: Start the Backend

1. Install dependencies:
   ```powershell
   go mod tidy
   ```

2. Run the server:
   ```powershell
   go run cmd/api/main.go
   ```

   Or build and run:
   ```powershell
   go build -o smartca-api.exe cmd/api/main.go
   .\smartca-api.exe
   ```

3. You should see:
   ```
   Database connected successfully
   Running migrations...
   Loading seed data...
   Server listening on 0.0.0.0:8080
   ```

## Step 4: Start the Frontend

1. Open a new terminal/PowerShell

2. Navigate to the frontend directory:
   ```powershell
   cd D:\SmartCA\saas
   ```

3. Install dependencies (first time only):
   ```powershell
   npm install
   ```

4. Start the development server:
   ```powershell
   npm run dev
   ```

5. Open your browser to: http://localhost:5173

## Step 5: Login

Use one of the demo accounts:

### Super Admin
- Email: `rajesh.sharma@smartca.in`
- Password: `SmartCA@2025`

### Manager
- Email: `priya.patel@smartca.in`
- Password: `SmartCA@2025`

### Accountant
- Email: `amit.kumar@smartca.in`
- Password: `SmartCA@2025`

## Verify Installation

### Check API Health

```powershell
# Windows PowerShell
Invoke-WebRequest http://localhost:8080/health/live
```

```bash
# Linux/Mac
curl http://localhost:8080/health/live
```

Expected response:
```json
{"success":true,"data":{"status":"live"},"meta":{"requestId":"..."}}
```

### Check Database Connection

```powershell
# Windows
$env:PGPASSWORD="yourpassword"; & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U smartca -h localhost -d smartca -c "SELECT COUNT(*) FROM users;"
```

```bash
# Linux/Mac
PGPASSWORD=yourpassword psql -U smartca -h localhost -d smartca -c "SELECT COUNT(*) FROM users;"
```

Expected: Should show the count of users (e.g., 10+)

## Troubleshooting

### Database Connection Failed

**Error:** `connection refused` or `password authentication failed`

**Solution:**
1. Verify PostgreSQL is running:
   - Windows: Check Services for "postgresql-x64-18"
   - Linux: `sudo systemctl status postgresql`

2. Verify credentials in `.env` match your database setup

3. Test connection manually:
   ```powershell
   # Windows
   $env:PGPASSWORD="yourpassword"; & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U smartca -h localhost -d smartca
   ```

### Port Already in Use

**Error:** `bind: address already in use`

**Solution:**
1. Check if another instance is running:
   ```powershell
   # Windows
   Get-NetTCPConnection -LocalPort 8080
   ```

2. Kill the process or change the port in `.env`:
   ```env
   HTTP_PORT=8081
   ```

### Migration Failed

**Error:** `migration failed` or `relation already exists`

**Solution:**
1. Drop and recreate the database:
   ```sql
   DROP DATABASE smartca;
   CREATE DATABASE smartca;
   ```

2. Restart the Go server (it will run migrations automatically)

### Frontend Can't Connect to API

**Error:** `Network Error` or `CORS error`

**Solution:**
1. Verify backend is running on port 8080

2. Check `.env` has correct FRONTEND_ORIGIN:
   ```env
   FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
   ```

3. Restart the backend after changing `.env`

## Development Tips

### Reset Database

To reset the database to initial seed data:

1. **Using the API** (if DEMO_RESET_ENABLED=true):
   ```bash
   curl -X POST http://localhost:8080/api/v1/demo/reset \
     -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
   ```

2. **Manual reset**:
   ```powershell
   # Stop the server
   # Drop and recreate database
   $env:PGPASSWORD="yourpassword"
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U smartca -h localhost -d postgres -c "DROP DATABASE smartca;"
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U smartca -h localhost -d postgres -c "CREATE DATABASE smartca;"
   # Restart the server (will run migrations and seed data)
   ```

### Run Tests

```powershell
# Format code
go fmt ./...

# Vet code
go vet ./...

# Run tests
go test ./...

# Run specific test
go test ./internal/app/services/... -run TestPaymentFinancialChain -v

# Benchmarks
go test ./internal/app/services/... -bench . -benchmem
```

### Database Migrations

Migrations are in `migrations/` and run automatically on startup.

To add a new migration:

1. Create files:
   - `migrations/XXX_description.up.sql` (for upgrade)
   - `migrations/XXX_description.down.sql` (for rollback)

2. Restart the server

### View Database

**Using psql:**
```powershell
$env:PGPASSWORD="yourpassword"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U smartca -h localhost -d smartca
```

**Using pgAdmin 4:**
1. Open pgAdmin 4
2. Connect to localhost
3. Navigate to: Servers → PostgreSQL 18 → Databases → smartca

## Production Deployment

For production deployment:

1. **Change the database password** in `.env`
2. Set `DB_SSLMODE=require` in `.env`
3. Set `APP_ENV=production` in `.env`
4. Set `DEMO_RESET_ENABLED=false` in `.env`
5. Build the Go binary:
   ```bash
   go build -o smartca-api cmd/api/main.go
   ```
6. Build the frontend:
   ```bash
   cd saas
   npm run build
   ```
7. Use a reverse proxy (nginx/caddy) to serve frontend and proxy API
8. Set up systemd service (Linux) or Windows Service for the backend
9. Use environment-specific database users and credentials
10. Enable PostgreSQL backups
11. Set up monitoring and logging

## Next Steps

- Read the [Database Schema documentation](../docs/database/DATABASE_SETUP.md)
- Read the [Migration Guide](../docs/database/MIGRATION_GUIDE.md)
- Check the [OpenAPI reference](../docs/api/openapi.yaml)
- Explore the codebase structure

## Support

For issues or questions:
- Check the troubleshooting section above
- Review PostgreSQL logs
- Review application logs in the terminal
- Check that all prerequisites are installed

## Architecture

```
Browser
    ↓
React (Port 5173)
    ↓
REST API (Port 8080)
    ↓
Go Handlers
    ↓
Services
    ↓
Repository Interface
    ↓
PostgreSQL Repository
    ↓
PostgreSQL Database
```

All data flows through this architecture ensuring proper separation of concerns.
