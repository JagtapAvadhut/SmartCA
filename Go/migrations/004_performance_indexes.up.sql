-- 004: Performance indexes for hot list/login/FK filter paths.
-- Schema/API unchanged — expression + partial indexes only.

-- Hot-table archived + list order (matches GetAll ORDER BY created_at, id)
CREATE INDEX IF NOT EXISTS idx_payments_archived_created ON payments (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_invoices_archived_created ON invoices (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_clients_archived_created ON clients (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_archived_created ON tasks (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_employees_archived_created ON employees (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_companies_archived_created ON companies (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_documents_archived_created ON documents (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_archived_created ON notifications (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_activities_archived_created ON activities (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_gst_archived_created ON gst (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_itr_archived_created ON itr (archived, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_users_archived_created ON users (archived, created_at ASC, id ASC);

-- Auth login lookups (case-insensitive identifier match)
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users ((lower(data->>'email')));
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users ((lower(data->>'username')));
CREATE INDEX IF NOT EXISTS idx_users_login_id_lower ON users ((lower(data->>'loginId')));

-- Notification unread scans / MarkAllRead
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications ((data->>'read'))
  WHERE archived = FALSE;

-- Covering FK filters used by payment/invoice sync (archived-aware)
CREATE INDEX IF NOT EXISTS idx_payments_invoice_active
  ON payments (invoice_id)
  WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_client_active
  ON invoices (client_id)
  WHERE archived = FALSE;

-- Session token lookups (active only)
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_active
  ON auth_sessions (token)
  WHERE active = TRUE;

ANALYZE users;
ANALYZE clients;
ANALYZE invoices;
ANALYZE payments;
ANALYZE notifications;
ANALYZE auth_sessions;
