-- 007 down: drop Practice Core additions (retain 006 tables)

DROP INDEX IF EXISTS uq_wm_work_client_period;
DROP INDEX IF EXISTS uq_wm_work_company_period;
DROP INDEX IF EXISTS idx_wm_work_type;
DROP INDEX IF EXISTS idx_wm_work_risk;
DROP INDEX IF EXISTS idx_wm_work_overlay;
DROP INDEX IF EXISTS idx_wm_work_period;
DROP INDEX IF EXISTS idx_wm_work_assignee_id;
DROP INDEX IF EXISTS idx_wm_work_tl;
DROP INDEX IF EXISTS idx_wm_work_owner_ca;
DROP INDEX IF EXISTS idx_wm_work_engagement;
DROP INDEX IF EXISTS idx_wm_work_company;

ALTER TABLE wm_work_items DROP COLUMN IF EXISTS requires_partner_signoff;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS delegated_close;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS assignee_id;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS tl_id;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS owner_ca_id;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS risk_class;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS overlay;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS fy;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS period_key;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS work_type;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS engagement_id;
ALTER TABLE wm_work_items DROP COLUMN IF EXISTS company_id;

-- Restore legacy status check (best-effort; data may already be practice codes)
ALTER TABLE wm_work_items DROP CONSTRAINT IF EXISTS wm_work_items_status_check;
ALTER TABLE wm_work_items ADD CONSTRAINT wm_work_items_status_check CHECK (
    status IN ('todo','in_progress','blocked','review','completed','cancelled',
        'OPEN','DOCUMENT_PENDING','DOCUMENT_RECEIVED','IN_PROGRESS','BLOCKED','ON_HOLD',
        'READY_FOR_TL_VERIFY','TL_REJECTED','TL_VERIFIED','READY_FOR_CA_VERIFY',
        'CA_REJECTED','CA_VERIFIED','READY_FOR_MANAGER_CLOSE','DELIVERED','CLOSED','CANCELLED')
);

DROP TABLE IF EXISTS wm_work_transitions;
DROP TABLE IF EXISTS wm_checklist_items;
DROP TABLE IF EXISTS wm_intakes;
DROP TABLE IF EXISTS wm_engagements;
