-- 008 down: drop integrity constraints added by 008 (does not restore remapped statuses)

ALTER TABLE wm_work_items DROP CONSTRAINT IF EXISTS wm_work_items_risk_class_check;

ALTER TABLE wm_intakes DROP CONSTRAINT IF EXISTS fk_wm_intake_engagement;
ALTER TABLE wm_intakes DROP CONSTRAINT IF EXISTS fk_wm_intake_company;
ALTER TABLE wm_intakes DROP CONSTRAINT IF EXISTS fk_wm_intake_client;

ALTER TABLE wm_work_items DROP CONSTRAINT IF EXISTS fk_wm_work_engagement;
ALTER TABLE wm_work_items DROP CONSTRAINT IF EXISTS fk_wm_work_company;
ALTER TABLE wm_work_items DROP CONSTRAINT IF EXISTS fk_wm_work_client;

ALTER TABLE wm_engagements DROP CONSTRAINT IF EXISTS fk_wm_eng_company;
ALTER TABLE wm_engagements DROP CONSTRAINT IF EXISTS fk_wm_eng_client;
