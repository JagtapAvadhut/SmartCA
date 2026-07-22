-- Smart CA Initial Schema
-- Document-oriented PostgreSQL store compatible with the existing Record/API model.
-- Business entities live in store_records (JSONB). Auth sessions are relational.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================
-- DOCUMENT STORE (all business collections)
-- ====================================

CREATE TABLE IF NOT EXISTS store_records (
    collection  TEXT        NOT NULL,
    id          TEXT        NOT NULL,
    data        JSONB       NOT NULL,
    archived    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_store_records_collection ON store_records (collection);
CREATE INDEX IF NOT EXISTS idx_store_records_archived ON store_records (collection, archived);
CREATE INDEX IF NOT EXISTS idx_store_records_updated_at ON store_records (collection, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_records_data_gin ON store_records USING GIN (data jsonb_path_ops);

-- ====================================
-- AUTH SESSIONS (runtime opaque tokens)
-- ====================================

CREATE TABLE IF NOT EXISTS auth_sessions (
    id          TEXT        PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    token       TEXT        NOT NULL UNIQUE,
    device      TEXT,
    ip          TEXT,
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions (token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions (active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);

-- ====================================
-- CONVENIENCE VIEWS (SQL validation / reporting)
-- ====================================

CREATE OR REPLACE VIEW users AS
SELECT id,
       data->>'email' AS email,
       data->>'fullName' AS full_name,
       data->>'role' AS role,
       data->>'status' AS status,
       archived,
       created_at,
       updated_at,
       data
FROM store_records WHERE collection = 'users';

CREATE OR REPLACE VIEW roles AS
SELECT id, data->>'name' AS name, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'roles';

CREATE OR REPLACE VIEW permissions AS
SELECT id, data->>'module' AS module, data->>'action' AS action, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'permissions';

CREATE OR REPLACE VIEW clients AS
SELECT id,
       data->>'name' AS name,
       data->>'email' AS email,
       data->>'phone' AS phone,
       data->>'status' AS status,
       COALESCE((data->>'revenue')::numeric, 0) AS revenue,
       COALESCE((data->>'outstanding')::numeric, 0) AS outstanding,
       archived, created_at, updated_at, data
FROM store_records WHERE collection = 'clients';

CREATE OR REPLACE VIEW companies AS
SELECT id, data->>'name' AS name, data->>'clientId' AS client_id, data->>'status' AS status,
       archived, created_at, updated_at, data
FROM store_records WHERE collection = 'companies';

CREATE OR REPLACE VIEW employees AS
SELECT id,
       data->>'firstName' AS first_name,
       data->>'lastName' AS last_name,
       data->>'email' AS email,
       data->>'status' AS status,
       archived, created_at, updated_at, data
FROM store_records WHERE collection = 'employees';

CREATE OR REPLACE VIEW invoices AS
SELECT id,
       data->>'invoiceNumber' AS invoice_number,
       data->>'clientId' AS client_id,
       data->>'status' AS status,
       COALESCE((data->>'total')::numeric, 0) AS total,
       COALESCE((data->>'paidAmount')::numeric, 0) AS paid_amount,
       COALESCE((data->>'remainingAmount')::numeric, 0) AS remaining_amount,
       archived, created_at, updated_at, data
FROM store_records WHERE collection = 'invoices';

CREATE OR REPLACE VIEW invoice_items AS
SELECT id, data->>'invoiceId' AS invoice_id, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'invoice_items';

CREATE OR REPLACE VIEW payments AS
SELECT id,
       data->>'invoiceId' AS invoice_id,
       data->>'clientId' AS client_id,
       COALESCE((data->>'amount')::numeric, 0) AS amount,
       data->>'status' AS status,
       archived, created_at, updated_at, data
FROM store_records WHERE collection = 'payments';

CREATE OR REPLACE VIEW documents AS
SELECT id, data->>'name' AS name, data->>'clientId' AS client_id, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'documents';

CREATE OR REPLACE VIEW folders AS
SELECT id, data->>'name' AS name, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'folders';

CREATE OR REPLACE VIEW tasks AS
SELECT id, data->>'title' AS title, data->>'status' AS status, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'tasks';

CREATE OR REPLACE VIEW notes AS
SELECT id, data->>'title' AS title, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'notes';

CREATE OR REPLACE VIEW activities AS
SELECT id, data->>'message' AS message, data->>'type' AS type, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'activities';

CREATE OR REPLACE VIEW audit_logs AS
SELECT id, data->>'action' AS action, data->>'entity' AS entity, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'auditLogs';

CREATE OR REPLACE VIEW gst AS
SELECT id, data->>'clientName' AS client_name, data->>'status' AS status, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'gst';

CREATE OR REPLACE VIEW itr AS
SELECT id, data->>'clientName' AS client_name, data->>'status' AS status, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'itr';

CREATE OR REPLACE VIEW tds AS
SELECT id, data->>'clientName' AS client_name, data->>'status' AS status, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'tds';

CREATE OR REPLACE VIEW roc AS
SELECT id, data->>'companyName' AS company_name, data->>'status' AS status, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'roc';

CREATE OR REPLACE VIEW calendar_events AS
SELECT id, data->>'title' AS title, data->>'type' AS type, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'calendar';

CREATE OR REPLACE VIEW notifications AS
SELECT id, data->>'title' AS title, data->>'type' AS type, archived, created_at, updated_at, data
FROM store_records WHERE collection = 'notifications';

CREATE OR REPLACE VIEW settings AS
SELECT id, data, archived, created_at, updated_at
FROM store_records WHERE collection = 'settings';

-- ====================================
-- updated_at trigger
-- ====================================

CREATE OR REPLACE FUNCTION touch_store_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_records_updated_at ON store_records;
CREATE TRIGGER trg_store_records_updated_at
    BEFORE UPDATE ON store_records
    FOR EACH ROW
    EXECUTE FUNCTION touch_store_records_updated_at();
