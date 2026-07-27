-- 006: Enterprise Work Management (normalized, soft-delete, audit)

CREATE TABLE IF NOT EXISTS wm_work_items (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','urgent')),
    status          TEXT NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo','in_progress','blocked','review','completed','cancelled')),
    due_date        TIMESTAMPTZ,
    created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by     TEXT NOT NULL,
    assigned_to     TEXT NOT NULL,
    client_id       TEXT,
    client_name     TEXT NOT NULL DEFAULT '',
    department      TEXT NOT NULL DEFAULT '',
    tags            TEXT[] NOT NULL DEFAULT '{}',
    estimated_hours DOUBLE PRECISION NOT NULL DEFAULT 0,
    actual_hours    DOUBLE PRECISION NOT NULL DEFAULT 0,
    completion_pct  INTEGER NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
    parent_id       TEXT REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    created_by      TEXT NOT NULL,
    updated_by      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_wm_work_status ON wm_work_items(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_priority ON wm_work_items(priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_assignee ON wm_work_items(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_assigner ON wm_work_items(assigned_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_client ON wm_work_items(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_dept ON wm_work_items(department) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_due ON wm_work_items(due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_parent ON wm_work_items(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_search ON wm_work_items USING GIN (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(client_name,'') || ' ' || coalesce(department,''))
);

CREATE TABLE IF NOT EXISTS wm_followups (
    id                  TEXT PRIMARY KEY,
    work_item_id        TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    followup_date       DATE NOT NULL,
    followup_time       TIME,
    created_by          TEXT NOT NULL,
    notes               TEXT NOT NULL DEFAULT '',
    next_followup_date  DATE,
    reminder            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    deleted_by          TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_followups_work ON wm_followups(work_item_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS wm_call_logs (
    id                  TEXT PRIMARY KEY,
    work_item_id        TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    call_date           DATE NOT NULL,
    call_time           TIME,
    direction           TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
    duration_minutes    INTEGER NOT NULL DEFAULT 0,
    person_spoken_to    TEXT NOT NULL DEFAULT '',
    designation         TEXT NOT NULL DEFAULT '',
    phone_number        TEXT NOT NULL DEFAULT '',
    summary             TEXT NOT NULL DEFAULT '',
    detailed_notes      TEXT NOT NULL DEFAULT '',
    action_items        TEXT NOT NULL DEFAULT '',
    next_call_date      DATE,
    created_by          TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    deleted_by          TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_calls_work ON wm_call_logs(work_item_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS wm_email_logs (
    id              TEXT PRIMARY KEY,
    work_item_id    TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    email_date      DATE NOT NULL,
    email_time      TIME,
    from_addr       TEXT NOT NULL DEFAULT '',
    to_addr         TEXT NOT NULL DEFAULT '',
    cc_addr         TEXT NOT NULL DEFAULT '',
    subject         TEXT NOT NULL DEFAULT '',
    summary         TEXT NOT NULL DEFAULT '',
    attachments     TEXT[] NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('draft','sent','received','failed')),
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_emails_work ON wm_email_logs(work_item_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS wm_meeting_logs (
    id                  TEXT PRIMARY KEY,
    work_item_id        TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    meeting_date        DATE NOT NULL,
    meeting_time        TIME,
    location            TEXT NOT NULL DEFAULT '',
    online_link         TEXT NOT NULL DEFAULT '',
    participants        TEXT[] NOT NULL DEFAULT '{}',
    discussion_notes    TEXT NOT NULL DEFAULT '',
    decisions           TEXT NOT NULL DEFAULT '',
    action_items        TEXT NOT NULL DEFAULT '',
    created_by          TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    deleted_by          TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_meetings_work ON wm_meeting_logs(work_item_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS wm_notes (
    id              TEXT PRIMARY KEY,
    work_item_id    TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    body            TEXT NOT NULL DEFAULT '',
    format          TEXT NOT NULL DEFAULT 'markdown' CHECK (format IN ('markdown','html','plain')),
    attachment_ids  TEXT[] NOT NULL DEFAULT '{}',
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at       TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_notes_work ON wm_notes(work_item_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS wm_comments (
    id              TEXT PRIMARY KEY,
    work_item_id    TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    body            TEXT NOT NULL,
    mentions        TEXT[] NOT NULL DEFAULT '{}',
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_comments_work ON wm_comments(work_item_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS wm_attachments (
    id              TEXT PRIMARY KEY,
    work_item_id    TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    file_name       TEXT NOT NULL,
    content_type    TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    storage_path    TEXT NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'other'
                    CHECK (kind IN ('pdf','excel','word','image','zip','other')),
    uploaded_by     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_attachments_work ON wm_attachments(work_item_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS wm_activity (
    id              TEXT PRIMARY KEY,
    work_item_id    TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    action          TEXT NOT NULL,
    summary         TEXT NOT NULL DEFAULT '',
    actor_id        TEXT NOT NULL,
    actor_name      TEXT NOT NULL DEFAULT '',
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wm_activity_work ON wm_activity(work_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wm_audit (
    id              TEXT PRIMARY KEY,
    work_item_id    TEXT,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    field_name      TEXT NOT NULL DEFAULT '',
    old_value       TEXT NOT NULL DEFAULT '',
    new_value       TEXT NOT NULL DEFAULT '',
    user_id         TEXT NOT NULL,
    ip_address      TEXT NOT NULL DEFAULT '',
    user_agent      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wm_audit_work ON wm_audit(work_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wm_audit_entity ON wm_audit(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS wm_notifications (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    work_item_id    TEXT,
    kind            TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL DEFAULT '',
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wm_notif_user ON wm_notifications(user_id, created_at DESC) WHERE deleted_at IS NULL;
