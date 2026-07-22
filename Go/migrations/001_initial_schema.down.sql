DROP TRIGGER IF EXISTS trg_store_records_updated_at ON store_records;
DROP FUNCTION IF EXISTS touch_store_records_updated_at();

DROP VIEW IF EXISTS settings;
DROP VIEW IF EXISTS notifications;
DROP VIEW IF EXISTS calendar_events;
DROP VIEW IF EXISTS roc;
DROP VIEW IF EXISTS tds;
DROP VIEW IF EXISTS itr;
DROP VIEW IF EXISTS gst;
DROP VIEW IF EXISTS audit_logs;
DROP VIEW IF EXISTS activities;
DROP VIEW IF EXISTS notes;
DROP VIEW IF EXISTS tasks;
DROP VIEW IF EXISTS folders;
DROP VIEW IF EXISTS documents;
DROP VIEW IF EXISTS payments;
DROP VIEW IF EXISTS invoice_items;
DROP VIEW IF EXISTS invoices;
DROP VIEW IF EXISTS employees;
DROP VIEW IF EXISTS companies;
DROP VIEW IF EXISTS clients;
DROP VIEW IF EXISTS permissions;
DROP VIEW IF EXISTS roles;
DROP VIEW IF EXISTS users;

DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS store_records;
