-- 007: Practice Core — engagements, intakes, checklist, work triad/status/period/risk
-- Additive on wm_* from 006; soft-delete preserved.

-- Engagements (retainer)
CREATE TABLE IF NOT EXISTS wm_engagements (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL,
    company_id      TEXT,
    owner_ca_id     TEXT NOT NULL DEFAULT '',
    services        TEXT[] NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'ACTIVE',
    fy              TEXT NOT NULL DEFAULT '',
    title           TEXT NOT NULL DEFAULT '',
    created_by      TEXT NOT NULL,
    updated_by      TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_eng_client ON wm_engagements(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_eng_owner ON wm_engagements(owner_ca_id) WHERE deleted_at IS NULL;

-- Reception intakes
CREATE TABLE IF NOT EXISTS wm_intakes (
    id              TEXT PRIMARY KEY,
    status          TEXT NOT NULL DEFAULT 'INTAKE'
                    CHECK (status IN ('INTAKE','APPROVED','REJECTED')),
    source          TEXT NOT NULL DEFAULT '',
    contact_name    TEXT NOT NULL DEFAULT '',
    contact_phone   TEXT NOT NULL DEFAULT '',
    contact_email   TEXT NOT NULL DEFAULT '',
    services        TEXT[] NOT NULL DEFAULT '{}',
    notes           TEXT NOT NULL DEFAULT '',
    payload         JSONB NOT NULL DEFAULT '{}',
    created_by      TEXT NOT NULL,
    approved_by     TEXT,
    rejected_by     TEXT,
    reject_remarks  TEXT NOT NULL DEFAULT '',
    client_id       TEXT,
    company_id      TEXT,
    engagement_id   TEXT,
    owner_ca_id     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_intake_status ON wm_intakes(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_intake_created ON wm_intakes(created_by) WHERE deleted_at IS NULL;

-- Document checklist
CREATE TABLE IF NOT EXISTS wm_checklist_items (
    id              TEXT PRIMARY KEY,
    work_item_id    TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    code            TEXT NOT NULL DEFAULT '',
    label           TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','received','verified','rejected')),
    remarks         TEXT NOT NULL DEFAULT '',
    verified_by     TEXT,
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_wm_checklist_work ON wm_checklist_items(work_item_id) WHERE deleted_at IS NULL;

-- Explicit transition history (four shadows companion)
CREATE TABLE IF NOT EXISTS wm_work_transitions (
    id              TEXT PRIMARY KEY,
    work_item_id    TEXT NOT NULL REFERENCES wm_work_items(id) ON DELETE RESTRICT,
    from_status     TEXT NOT NULL DEFAULT '',
    to_status       TEXT NOT NULL DEFAULT '',
    action          TEXT NOT NULL DEFAULT '',
    remarks         TEXT NOT NULL DEFAULT '',
    actor_id        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wm_transitions_work ON wm_work_transitions(work_item_id, created_at DESC);

-- Alter work items: triad, engagement, period, risk, overlay
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS engagement_id TEXT;
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT '';
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS period_key TEXT NOT NULL DEFAULT '';
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS fy TEXT NOT NULL DEFAULT '';
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS overlay TEXT NOT NULL DEFAULT '';
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS risk_class TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS owner_ca_id TEXT NOT NULL DEFAULT '';
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS tl_id TEXT NOT NULL DEFAULT '';
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS assignee_id TEXT NOT NULL DEFAULT '';
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS delegated_close BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE wm_work_items ADD COLUMN IF NOT EXISTS requires_partner_signoff BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill assignee_id from assigned_to
UPDATE wm_work_items SET assignee_id = assigned_to WHERE assignee_id = '' AND assigned_to <> '';

-- Expand status CHECK for dual-read (legacy + practice)
ALTER TABLE wm_work_items DROP CONSTRAINT IF EXISTS wm_work_items_status_check;
ALTER TABLE wm_work_items ADD CONSTRAINT wm_work_items_status_check CHECK (
    status IN (
        'todo','in_progress','blocked','review','completed','cancelled',
        'OPEN','DOCUMENT_PENDING','DOCUMENT_RECEIVED','IN_PROGRESS','BLOCKED','ON_HOLD',
        'READY_FOR_TL_VERIFY','TL_REJECTED','TL_VERIFIED','READY_FOR_CA_VERIFY',
        'CA_REJECTED','CA_VERIFIED','READY_FOR_MANAGER_CLOSE','DELIVERED','CLOSED','CANCELLED'
    )
);

-- Legacy → practice backfill (Architecture §6.1: completed→CLOSED only if risk=low)
UPDATE wm_work_items SET status = CASE status
    WHEN 'todo' THEN 'OPEN'
    WHEN 'in_progress' THEN 'IN_PROGRESS'
    WHEN 'blocked' THEN 'BLOCKED'
    WHEN 'review' THEN 'READY_FOR_TL_VERIFY'
    WHEN 'completed' THEN CASE
        WHEN LOWER(COALESCE(risk_class, 'medium')) = 'low' THEN 'CLOSED'
        ELSE 'READY_FOR_MANAGER_CLOSE'
    END
    WHEN 'cancelled' THEN 'CANCELLED'
    ELSE status
END
WHERE status IN ('todo','in_progress','blocked','review','completed','cancelled');

CREATE INDEX IF NOT EXISTS idx_wm_work_company ON wm_work_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_engagement ON wm_work_items(engagement_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_owner_ca ON wm_work_items(owner_ca_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_tl ON wm_work_items(tl_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_assignee_id ON wm_work_items(assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_period ON wm_work_items(period_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_overlay ON wm_work_items(overlay) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_risk ON wm_work_items(risk_class) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_work_type ON wm_work_items(work_type) WHERE deleted_at IS NULL;

-- Unique period works per company (corporate)
CREATE UNIQUE INDEX IF NOT EXISTS uq_wm_work_company_period
    ON wm_work_items(company_id, work_type, period_key)
    WHERE deleted_at IS NULL AND company_id IS NOT NULL AND company_id <> '' AND period_key <> '';

-- Unique period works per client when no company (individual ITR etc.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_wm_work_client_period
    ON wm_work_items(client_id, work_type, period_key)
    WHERE deleted_at IS NULL AND (company_id IS NULL OR company_id = '') AND client_id IS NOT NULL AND client_id <> '' AND period_key <> '';
