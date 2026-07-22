-- 002: Convert entity VIEWS into BASE TABLES (forensic requirement)
-- Source of truth remains JSONB `data` column; app Record model unchanged.

-- Drop convenience views from 001
DROP VIEW IF EXISTS settings CASCADE;
DROP VIEW IF EXISTS notifications CASCADE;
DROP VIEW IF EXISTS calendar_events CASCADE;
DROP VIEW IF EXISTS roc CASCADE;
DROP VIEW IF EXISTS tds CASCADE;
DROP VIEW IF EXISTS itr CASCADE;
DROP VIEW IF EXISTS gst CASCADE;
DROP VIEW IF EXISTS audit_logs CASCADE;
DROP VIEW IF EXISTS activities CASCADE;
DROP VIEW IF EXISTS notes CASCADE;
DROP VIEW IF EXISTS tasks CASCADE;
DROP VIEW IF EXISTS folders CASCADE;
DROP VIEW IF EXISTS documents CASCADE;
DROP VIEW IF EXISTS payments CASCADE;
DROP VIEW IF EXISTS invoice_items CASCADE;
DROP VIEW IF EXISTS invoices CASCADE;
DROP VIEW IF EXISTS employees CASCADE;
DROP VIEW IF EXISTS companies CASCADE;
DROP VIEW IF EXISTS clients CASCADE;
DROP VIEW IF EXISTS permissions CASCADE;
DROP VIEW IF EXISTS roles CASCADE;
DROP VIEW IF EXISTS users CASCADE;

-- Generic entity table factory pattern
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS gst (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS itr (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tds (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS roc (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supporting app collections
CREATE TABLE IF NOT EXISTS compliance (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chat (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS journals (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions_data (
    id TEXT PRIMARY KEY, data JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate from store_records
INSERT INTO users SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'users' ON CONFLICT (id) DO NOTHING;
INSERT INTO roles SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'roles' ON CONFLICT (id) DO NOTHING;
INSERT INTO permissions SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'permissions' ON CONFLICT (id) DO NOTHING;
INSERT INTO clients SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'clients' ON CONFLICT (id) DO NOTHING;
INSERT INTO companies SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'companies' ON CONFLICT (id) DO NOTHING;
INSERT INTO employees SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'employees' ON CONFLICT (id) DO NOTHING;
INSERT INTO invoices SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'invoices' ON CONFLICT (id) DO NOTHING;
INSERT INTO payments SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'payments' ON CONFLICT (id) DO NOTHING;
INSERT INTO documents SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'documents' ON CONFLICT (id) DO NOTHING;
INSERT INTO folders SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'folders' ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'tasks' ON CONFLICT (id) DO NOTHING;
INSERT INTO activities SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'activities' ON CONFLICT (id) DO NOTHING;
INSERT INTO audit_logs SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'auditLogs' ON CONFLICT (id) DO NOTHING;
INSERT INTO notifications SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'notifications' ON CONFLICT (id) DO NOTHING;
INSERT INTO settings SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'settings' ON CONFLICT (id) DO NOTHING;
INSERT INTO gst SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'gst' ON CONFLICT (id) DO NOTHING;
INSERT INTO itr SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'itr' ON CONFLICT (id) DO NOTHING;
INSERT INTO tds SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'tds' ON CONFLICT (id) DO NOTHING;
INSERT INTO roc SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'roc' ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'calendar' ON CONFLICT (id) DO NOTHING;
INSERT INTO notes SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'notes' ON CONFLICT (id) DO NOTHING;
INSERT INTO organizations SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'organization' ON CONFLICT (id) DO NOTHING;
INSERT INTO compliance SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'compliance' ON CONFLICT (id) DO NOTHING;
INSERT INTO chat SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'chat' ON CONFLICT (id) DO NOTHING;
INSERT INTO departments SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'departments' ON CONFLICT (id) DO NOTHING;
INSERT INTO branches SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'branches' ON CONFLICT (id) DO NOTHING;
INSERT INTO login_history SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'loginHistory' ON CONFLICT (id) DO NOTHING;
INSERT INTO journals SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'journals' ON CONFLICT (id) DO NOTHING;
INSERT INTO sessions_data SELECT id, data, archived, created_at, updated_at FROM store_records WHERE collection = 'sessions' ON CONFLICT (id) DO NOTHING;

-- Explode embedded invoice line items into invoice_items
INSERT INTO invoice_items (id, data, archived, created_at, updated_at)
SELECT
    inv.id || '-ITEM-' || (ordinality::text),
    jsonb_build_object(
        'id', inv.id || '-ITEM-' || (ordinality::text),
        'invoiceId', inv.id,
        'description', COALESCE(item->>'description', ''),
        'quantity', COALESCE((item->>'quantity')::numeric, 1),
        'rate', COALESCE((item->>'rate')::numeric, 0),
        'amount', COALESCE((item->>'amount')::numeric, 0)
    ),
    inv.archived,
    inv.created_at,
    inv.updated_at
FROM invoices inv
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(inv.data->'items', '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
ON CONFLICT (id) DO NOTHING;

-- Seed default folders if empty
INSERT INTO folders (id, data, archived)
SELECT 'FLD-0001', '{"id":"FLD-0001","name":"Client Documents","parentId":null}'::jsonb, false
WHERE NOT EXISTS (SELECT 1 FROM folders LIMIT 1);
INSERT INTO folders (id, data, archived)
SELECT 'FLD-0002', '{"id":"FLD-0002","name":"Compliance","parentId":null}'::jsonb, false
WHERE (SELECT COUNT(*) FROM folders) < 2;
INSERT INTO folders (id, data, archived)
SELECT 'FLD-0003', '{"id":"FLD-0003","name":"Invoices","parentId":null}'::jsonb, false
WHERE (SELECT COUNT(*) FROM folders) < 3;

-- Generated relationship columns + indexes + FKs
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id TEXT GENERATED ALWAYS AS (NULLIF(data->>'clientId','')) STORED;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id TEXT GENERATED ALWAYS AS (NULLIF(data->>'invoiceId','')) STORED;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_id TEXT GENERATED ALWAYS AS (NULLIF(data->>'clientId','')) STORED;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS client_id TEXT GENERATED ALWAYS AS (NULLIF(data->>'clientId','')) STORED;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS invoice_id TEXT GENERATED ALWAYS AS (NULLIF(data->>'invoiceId','')) STORED;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_id TEXT GENERATED ALWAYS AS (NULLIF(data->>'clientId','')) STORED;

CREATE INDEX IF NOT EXISTS idx_clients_archived ON clients (archived);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_archived ON invoices (archived);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments (client_id);
CREATE INDEX IF NOT EXISTS idx_companies_client_id ON companies (client_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users ((data->>'email'));
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients ((data->>'name'));
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents (client_id);

-- FK constraints (orphan checks already clean for invoices/payments)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS fk_invoices_client;
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_invoice;
ALTER TABLE payments ADD CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_client;
ALTER TABLE payments ADD CONSTRAINT fk_payments_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS fk_invoice_items_invoice;
ALTER TABLE invoice_items ADD CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

-- updated_at triggers
CREATE OR REPLACE FUNCTION touch_entity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','roles','permissions','clients','companies','employees','invoices','invoice_items',
    'payments','documents','folders','tasks','activities','audit_logs','notifications','settings',
    'gst','itr','tds','roc','calendar_events','notes','organizations','compliance','chat',
    'departments','branches','login_history','journals','sessions_data'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_entity_updated_at()', t, t);
  END LOOP;
END $$;
