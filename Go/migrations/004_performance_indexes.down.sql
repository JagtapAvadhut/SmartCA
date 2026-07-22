-- 004 down: drop performance indexes introduced in 004_performance_indexes.up.sql

DROP INDEX IF EXISTS idx_auth_sessions_token_active;
DROP INDEX IF EXISTS idx_invoices_client_active;
DROP INDEX IF EXISTS idx_payments_invoice_active;
DROP INDEX IF EXISTS idx_notifications_unread;
DROP INDEX IF EXISTS idx_users_login_id_lower;
DROP INDEX IF EXISTS idx_users_username_lower;
DROP INDEX IF EXISTS idx_users_email_lower;
DROP INDEX IF EXISTS idx_users_archived_created;
DROP INDEX IF EXISTS idx_itr_archived_created;
DROP INDEX IF EXISTS idx_gst_archived_created;
DROP INDEX IF EXISTS idx_activities_archived_created;
DROP INDEX IF EXISTS idx_notifications_archived_created;
DROP INDEX IF EXISTS idx_documents_archived_created;
DROP INDEX IF EXISTS idx_companies_archived_created;
DROP INDEX IF EXISTS idx_employees_archived_created;
DROP INDEX IF EXISTS idx_tasks_archived_created;
DROP INDEX IF EXISTS idx_clients_archived_created;
DROP INDEX IF EXISTS idx_invoices_archived_created;
DROP INDEX IF EXISTS idx_payments_archived_created;
