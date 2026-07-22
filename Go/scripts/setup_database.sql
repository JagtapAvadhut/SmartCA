-- Smart CA PostgreSQL Setup Script
-- Run this as postgres superuser:
-- psql -U postgres -h localhost -f setup_database.sql

-- Create database
DROP DATABASE IF EXISTS smartca;
CREATE DATABASE smartca;

-- Create user
DROP USER IF EXISTS smartca;
CREATE USER smartca WITH PASSWORD 'yourpassword';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE smartca TO smartca;

-- Connect to smartca database
\c smartca

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO smartca;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smartca;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smartca;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO smartca;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO smartca;

-- Verify
SELECT current_database(), current_user;
