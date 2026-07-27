-- 008: Practice integrity — FKs to masters/engagements, risk-aware CLOSED remap safety,
--       risk_class CHECK. Additive on 007. Orphan-safe: nullify empty strings first.

-- Normalize empty FK strings to NULL (FK cannot reference '')
UPDATE wm_work_items SET company_id = NULL WHERE company_id IS NOT NULL AND company_id = '';
UPDATE wm_work_items SET engagement_id = NULL WHERE engagement_id IS NOT NULL AND engagement_id = '';
UPDATE wm_work_items SET client_id = NULL WHERE client_id IS NOT NULL AND client_id = '';
UPDATE wm_engagements SET company_id = NULL WHERE company_id IS NOT NULL AND company_id = '';
UPDATE wm_intakes SET client_id = NULL WHERE client_id IS NOT NULL AND client_id = '';
UPDATE wm_intakes SET company_id = NULL WHERE company_id IS NOT NULL AND company_id = '';
UPDATE wm_intakes SET engagement_id = NULL WHERE engagement_id IS NOT NULL AND engagement_id = '';

-- Clear orphan engagement/company/client refs that would block FK add (defensive)
UPDATE wm_work_items w SET engagement_id = NULL
WHERE w.engagement_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM wm_engagements e WHERE e.id = w.engagement_id);
UPDATE wm_work_items w SET company_id = NULL
WHERE w.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = w.company_id);
UPDATE wm_work_items w SET client_id = NULL
WHERE w.client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = w.client_id);
UPDATE wm_engagements e SET company_id = NULL
WHERE e.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = e.company_id);
UPDATE wm_intakes i SET engagement_id = NULL
WHERE i.engagement_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM wm_engagements e WHERE e.id = i.engagement_id);
UPDATE wm_intakes i SET company_id = NULL
WHERE i.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = i.company_id);
UPDATE wm_intakes i SET client_id = NULL
WHERE i.client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = i.client_id);

-- Engagements with invalid client_id cannot get FK; fail loudly if any remain
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM wm_engagements e
    WHERE e.client_id IS NULL OR e.client_id = ''
       OR NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = e.client_id)
  ) THEN
    RAISE EXCEPTION '008: wm_engagements has orphan/empty client_id; clean before FK';
  END IF;
END $$;

-- FKs (RESTRICT — soft-delete culture; no CASCADE)
ALTER TABLE wm_engagements
  DROP CONSTRAINT IF EXISTS fk_wm_eng_client;
ALTER TABLE wm_engagements
  ADD CONSTRAINT fk_wm_eng_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

ALTER TABLE wm_engagements
  DROP CONSTRAINT IF EXISTS fk_wm_eng_company;
ALTER TABLE wm_engagements
  ADD CONSTRAINT fk_wm_eng_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE wm_work_items
  DROP CONSTRAINT IF EXISTS fk_wm_work_client;
ALTER TABLE wm_work_items
  ADD CONSTRAINT fk_wm_work_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

ALTER TABLE wm_work_items
  DROP CONSTRAINT IF EXISTS fk_wm_work_company;
ALTER TABLE wm_work_items
  ADD CONSTRAINT fk_wm_work_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE wm_work_items
  DROP CONSTRAINT IF EXISTS fk_wm_work_engagement;
ALTER TABLE wm_work_items
  ADD CONSTRAINT fk_wm_work_engagement
  FOREIGN KEY (engagement_id) REFERENCES wm_engagements(id) ON DELETE RESTRICT;

ALTER TABLE wm_intakes
  DROP CONSTRAINT IF EXISTS fk_wm_intake_client;
ALTER TABLE wm_intakes
  ADD CONSTRAINT fk_wm_intake_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

ALTER TABLE wm_intakes
  DROP CONSTRAINT IF EXISTS fk_wm_intake_company;
ALTER TABLE wm_intakes
  ADD CONSTRAINT fk_wm_intake_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE wm_intakes
  DROP CONSTRAINT IF EXISTS fk_wm_intake_engagement;
ALTER TABLE wm_intakes
  ADD CONSTRAINT fk_wm_intake_engagement
  FOREIGN KEY (engagement_id) REFERENCES wm_engagements(id) ON DELETE RESTRICT;

-- risk_class CHECK (P1 from review; safe additive)
ALTER TABLE wm_work_items DROP CONSTRAINT IF EXISTS wm_work_items_risk_class_check;
ALTER TABLE wm_work_items
  ADD CONSTRAINT wm_work_items_risk_class_check
  CHECK (risk_class IN ('low', 'medium', 'high'));

-- Safety remap: CLOSED + medium/high without a close/verify_ca→CLOSED transition
-- (covers environments that applied pre-fix 007 blind completed→CLOSED)
UPDATE wm_work_items w
SET status = 'READY_FOR_MANAGER_CLOSE',
    updated_at = NOW()
WHERE w.status = 'CLOSED'
  AND LOWER(COALESCE(w.risk_class, 'medium')) IN ('medium', 'high')
  AND w.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM wm_work_transitions t
    WHERE t.work_item_id = w.id
      AND t.to_status = 'CLOSED'
      AND t.action IN ('close', 'verify_ca')
  );
