# Smart CA PostgreSQL Setup PowerShell Script
# This script attempts to set up the database with different approaches

param(
    [string]$PostgresPassword = ""
)

$PGBIN = "C:\Program Files\PostgreSQL\18\bin"
$PSQL = "$PGBIN\psql.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Smart CA Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if psql exists
if (-not (Test-Path $PSQL)) {
    Write-Host "ERROR: PostgreSQL psql.exe not found at $PSQL" -ForegroundColor Red
    Write-Host "Please install PostgreSQL or update the PGBIN variable." -ForegroundColor Red
    exit 1
}

# Prompt for password if not provided
if ([string]::IsNullOrEmpty($PostgresPassword)) {
    $securePassword = Read-Host "Enter postgres superuser password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $PostgresPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# Set environment variable for password
$env:PGPASSWORD = $PostgresPassword

Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow
$testResult = & $PSQL -U postgres -h localhost -c "SELECT 1;" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to connect to PostgreSQL" -ForegroundColor Red
    Write-Host $testResult -ForegroundColor Red
    Write-Host ""
    Write-Host "Please verify:" -ForegroundColor Yellow
    Write-Host "1. PostgreSQL service is running" -ForegroundColor Yellow
    Write-Host "2. postgres password is correct" -ForegroundColor Yellow
    exit 1
}

Write-Host "Connected successfully!" -ForegroundColor Green
Write-Host ""

# Run the setup SQL script
Write-Host "Running database setup SQL script..." -ForegroundColor Yellow
$scriptPath = Join-Path $PSScriptRoot "setup_database.sql"
$setupResult = & $PSQL -U postgres -h localhost -f $scriptPath 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Database setup completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Database: smartca" -ForegroundColor Cyan
    Write-Host "User: smartca" -ForegroundColor Cyan
    Write-Host "Password: yourpassword" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Update Go/.env with your database credentials" -ForegroundColor Yellow
    Write-Host "2. Run: cd Go && go run cmd/api/main.go" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Database setup failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host $setupResult -ForegroundColor Red
    exit 1
}

# Verify setup
Write-Host "Verifying database setup..." -ForegroundColor Yellow
$env:PGPASSWORD = "yourpassword"
$verifyResult = & $PSQL -U smartca -h localhost -d smartca -c "SELECT current_database(), current_user;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host $verifyResult -ForegroundColor Green
    Write-Host ""
    Write-Host "Verification successful! Database is ready." -ForegroundColor Green
} else {
    Write-Host "Warning: Database created but verification failed:" -ForegroundColor Yellow
    Write-Host $verifyResult -ForegroundColor Yellow
}
