@echo off
REM Smart CA PostgreSQL Database Setup Script for Windows
REM This script creates the smartca database and user
REM
REM Prerequisites:
REM 1. PostgreSQL must be installed
REM 2. You need the postgres superuser password
REM
REM Usage: setup_database.bat

echo ========================================
echo Smart CA Database Setup
echo ========================================
echo.
echo This script will:
echo 1. Create the 'smartca' database
echo 2. Create the 'smartca' user
echo 3. Grant necessary privileges
echo.
echo You will be prompted for the postgres superuser password.
echo.
pause

REM Set PostgreSQL bin directory
set PGBIN="C:\Program Files\PostgreSQL\18\bin"

REM Check if psql exists
if not exist %PGBIN%\psql.exe (
    echo ERROR: PostgreSQL psql.exe not found at %PGBIN%
    echo Please update the PGBIN variable in this script with your PostgreSQL bin path.
    pause
    exit /b 1
)

REM Run the setup SQL script
echo.
echo Running database setup...
%PGBIN%\psql.exe -U postgres -h localhost -f "%~dp0setup_database.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Database setup completed successfully!
    echo ========================================
    echo.
    echo Database: smartca
    echo User: smartca
    echo Password: yourpassword
    echo.
    echo You can now run the Go application.
) else (
    echo.
    echo ========================================
    echo Database setup failed!
    echo ========================================
    echo.
    echo Please check the error messages above.
)

echo.
pause
