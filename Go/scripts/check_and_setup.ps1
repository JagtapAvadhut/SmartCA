# Smart CA PostgreSQL Setup PowerShell Script
# Non-interactive when POSTGRES_PASSWORD or -PostgresPassword is provided.
#
# Usage:
#   $env:POSTGRES_PASSWORD = 'your-postgres-superuser-password'
#   .\check_and_setup.ps1
#   # or:
#   .\check_and_setup.ps1 -PostgresPassword 'your-postgres-superuser-password'
#
# Creates DB/user with app credentials matching /.env.example and Go/.env.example:
#   user/password/db = smartca / smartca / smartca

param(
    [string]$PostgresPassword = $env:POSTGRES_PASSWORD
)

$ErrorActionPreference = "Stop"
$PGBIN = "C:\Program Files\PostgreSQL\18\bin"
if (-not (Test-Path "$PGBIN\psql.exe")) {
    $PGBIN = "C:\Program Files\PostgreSQL\16\bin"
}
if (-not (Test-Path "$PGBIN\psql.exe")) {
    $PGBIN = "C:\Program Files\PostgreSQL\15\bin"
}
$PSQL = "$PGBIN\psql.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Smart CA Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $PSQL)) {
    Write-Host "ERROR: PostgreSQL psql.exe not found under Program Files\PostgreSQL." -ForegroundColor Red
    Write-Host "Install PostgreSQL 14+ or prefer Docker: docker compose up --build" -ForegroundColor Yellow
    exit 1
}

if ([string]::IsNullOrEmpty($PostgresPassword)) {
    Write-Host "ERROR: Postgres superuser password required (non-interactive)." -ForegroundColor Red
    Write-Host "Set env POSTGRES_PASSWORD or pass -PostgresPassword." -ForegroundColor Yellow
    Write-Host "Prefer Docker if you do not manage a local PostgreSQL: docker compose up --build" -ForegroundColor Yellow
    exit 1
}

$env:PGPASSWORD = $PostgresPassword

Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow
& $PSQL -U postgres -h localhost -c "SELECT 1;" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to connect as postgres@localhost" -ForegroundColor Red
    exit 1
}

Write-Host "Connected successfully!" -ForegroundColor Green
Write-Host "Running database setup SQL script..." -ForegroundColor Yellow
$scriptPath = Join-Path $PSScriptRoot "setup_database.sql"
& $PSQL -U postgres -h localhost -f $scriptPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "Database setup failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Database setup completed successfully!" -ForegroundColor Green
Write-Host "Database: smartca" -ForegroundColor Cyan
Write-Host "User:     smartca" -ForegroundColor Cyan
Write-Host "Password: smartca" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: copy Go/.env.example -> Go/.env (defaults already match), then:" -ForegroundColor Yellow
Write-Host "  cd Go; go run ./cmd/api" -ForegroundColor Yellow

$env:PGPASSWORD = "smartca"
& $PSQL -U smartca -h localhost -d smartca -c "SELECT current_database(), current_user;" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Verification successful! Database is ready." -ForegroundColor Green
} else {
    Write-Host "Warning: created but verification as smartca failed." -ForegroundColor Yellow
}
