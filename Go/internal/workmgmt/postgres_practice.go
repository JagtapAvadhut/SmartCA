package workmgmt

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/lib/pq"
)

func (s *PostgresStore) CreateEngagement(ctx context.Context, e *Engagement) error {
	if e.ID == "" {
		e.ID = newID()
	}
	now := time.Now().UTC()
	e.CreatedAt, e.UpdatedAt = now, now
	if e.Services == nil {
		e.Services = []string{}
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_engagements (id, client_id, company_id, owner_ca_id, services, status, fy, title, created_by, updated_by, created_at, updated_at)
		VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		e.ID, e.ClientID, e.CompanyID, e.OwnerCAID, pq.Array(e.Services), e.Status, e.FY, e.Title,
		e.CreatedBy, e.UpdatedBy, e.CreatedAt, e.UpdatedAt)
	return err
}

func (s *PostgresStore) UpdateEngagement(ctx context.Context, e *Engagement) error {
	e.UpdatedAt = time.Now().UTC()
	res, err := s.db.ExecContext(ctx, `
		UPDATE wm_engagements SET client_id=$2, company_id=NULLIF($3,''), owner_ca_id=$4, services=$5, status=$6, fy=$7, title=$8, updated_by=$9, updated_at=$10
		WHERE id=$1 AND deleted_at IS NULL`,
		e.ID, e.ClientID, e.CompanyID, e.OwnerCAID, pq.Array(e.Services), e.Status, e.FY, e.Title, e.UpdatedBy, e.UpdatedAt)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("engagement not found")
	}
	return nil
}

func (s *PostgresStore) GetEngagement(ctx context.Context, id string, includeDeleted bool) (*Engagement, error) {
	q := `SELECT id, client_id, COALESCE(company_id,''), owner_ca_id, services, status, fy, title, created_by, updated_by, created_at, updated_at, deleted_at
		FROM wm_engagements WHERE id=$1`
	if !includeDeleted {
		q += ` AND deleted_at IS NULL`
	}
	e := &Engagement{}
	var services pq.StringArray
	var del sql.NullTime
	err := s.db.QueryRowContext(ctx, q, id).Scan(
		&e.ID, &e.ClientID, &e.CompanyID, &e.OwnerCAID, &services, &e.Status, &e.FY, &e.Title,
		&e.CreatedBy, &e.UpdatedBy, &e.CreatedAt, &e.UpdatedAt, &del,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("engagement not found")
	}
	if err != nil {
		return nil, err
	}
	e.Services = []string(services)
	if del.Valid {
		t := del.Time
		e.DeletedAt = &t
	}
	return e, nil
}

func (s *PostgresStore) ListEngagements(ctx context.Context, clientID, ownerCAID string) ([]Engagement, error) {
	q := `SELECT id, client_id, COALESCE(company_id,''), owner_ca_id, services, status, fy, title, created_by, updated_by, created_at, updated_at
		FROM wm_engagements WHERE deleted_at IS NULL`
	args := []any{}
	if clientID != "" {
		args = append(args, clientID)
		q += fmt.Sprintf(` AND client_id=$%d`, len(args))
	}
	if ownerCAID != "" {
		args = append(args, ownerCAID)
		q += fmt.Sprintf(` AND owner_ca_id=$%d`, len(args))
	}
	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Engagement{}
	for rows.Next() {
		var e Engagement
		var services pq.StringArray
		if err := rows.Scan(&e.ID, &e.ClientID, &e.CompanyID, &e.OwnerCAID, &services, &e.Status, &e.FY, &e.Title,
			&e.CreatedBy, &e.UpdatedBy, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		e.Services = []string(services)
		out = append(out, e)
	}
	return out, nil
}

func (s *PostgresStore) CreateIntake(ctx context.Context, in *Intake) error {
	if in.ID == "" {
		in.ID = newID()
	}
	now := time.Now().UTC()
	in.CreatedAt, in.UpdatedAt = now, now
	if in.Services == nil {
		in.Services = []string{}
	}
	if in.Payload == nil {
		in.Payload = map[string]any{}
	}
	payload, _ := json.Marshal(in.Payload)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_intakes (id, status, source, contact_name, contact_phone, contact_email, services, notes, payload, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		in.ID, in.Status, in.Source, in.ContactName, in.ContactPhone, in.ContactEmail,
		pq.Array(in.Services), in.Notes, payload, in.CreatedBy, in.CreatedAt, in.UpdatedAt)
	return err
}

func (s *PostgresStore) UpdateIntake(ctx context.Context, in *Intake) error {
	in.UpdatedAt = time.Now().UTC()
	if in.Payload == nil {
		in.Payload = map[string]any{}
	}
	payload, _ := json.Marshal(in.Payload)
	res, err := s.db.ExecContext(ctx, `
		UPDATE wm_intakes SET status=$2, source=$3, contact_name=$4, contact_phone=$5, contact_email=$6, services=$7, notes=$8, payload=$9,
			approved_by=$10, rejected_by=$11, reject_remarks=$12, client_id=NULLIF($13,''), company_id=NULLIF($14,''),
			engagement_id=NULLIF($15,''), owner_ca_id=NULLIF($16,''), updated_at=$17
		WHERE id=$1 AND deleted_at IS NULL`,
		in.ID, in.Status, in.Source, in.ContactName, in.ContactPhone, in.ContactEmail, pq.Array(in.Services), in.Notes, payload,
		nullStr(in.ApprovedBy), nullStr(in.RejectedBy), in.RejectRemarks, in.ClientID, in.CompanyID, in.EngagementID, in.OwnerCAID, in.UpdatedAt)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("intake not found")
	}
	return nil
}

func (s *PostgresStore) GetIntake(ctx context.Context, id string, includeDeleted bool) (*Intake, error) {
	q := `SELECT id, status, source, contact_name, contact_phone, contact_email, services, notes, payload,
		created_by, COALESCE(approved_by,''), COALESCE(rejected_by,''), reject_remarks,
		COALESCE(client_id,''), COALESCE(company_id,''), COALESCE(engagement_id,''), COALESCE(owner_ca_id,''),
		created_at, updated_at, deleted_at
		FROM wm_intakes WHERE id=$1`
	if !includeDeleted {
		q += ` AND deleted_at IS NULL`
	}
	in := &Intake{}
	var services pq.StringArray
	var payload []byte
	var del sql.NullTime
	err := s.db.QueryRowContext(ctx, q, id).Scan(
		&in.ID, &in.Status, &in.Source, &in.ContactName, &in.ContactPhone, &in.ContactEmail, &services, &in.Notes, &payload,
		&in.CreatedBy, &in.ApprovedBy, &in.RejectedBy, &in.RejectRemarks,
		&in.ClientID, &in.CompanyID, &in.EngagementID, &in.OwnerCAID,
		&in.CreatedAt, &in.UpdatedAt, &del,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("intake not found")
	}
	if err != nil {
		return nil, err
	}
	in.Services = []string(services)
	_ = json.Unmarshal(payload, &in.Payload)
	if in.Payload == nil {
		in.Payload = map[string]any{}
	}
	if del.Valid {
		t := del.Time
		in.DeletedAt = &t
	}
	return in, nil
}

func (s *PostgresStore) ListIntakes(ctx context.Context, status, createdBy string) ([]Intake, error) {
	q := `SELECT id, status, source, contact_name, contact_phone, contact_email, services, notes, payload,
		created_by, COALESCE(approved_by,''), COALESCE(rejected_by,''), reject_remarks,
		COALESCE(client_id,''), COALESCE(company_id,''), COALESCE(engagement_id,''), COALESCE(owner_ca_id,''),
		created_at, updated_at
		FROM wm_intakes WHERE deleted_at IS NULL`
	args := []any{}
	if status != "" {
		args = append(args, status)
		q += fmt.Sprintf(` AND status=$%d`, len(args))
	}
	if createdBy != "" {
		args = append(args, createdBy)
		q += fmt.Sprintf(` AND created_by=$%d`, len(args))
	}
	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Intake{}
	for rows.Next() {
		var in Intake
		var services pq.StringArray
		var payload []byte
		if err := rows.Scan(
			&in.ID, &in.Status, &in.Source, &in.ContactName, &in.ContactPhone, &in.ContactEmail, &services, &in.Notes, &payload,
			&in.CreatedBy, &in.ApprovedBy, &in.RejectedBy, &in.RejectRemarks,
			&in.ClientID, &in.CompanyID, &in.EngagementID, &in.OwnerCAID,
			&in.CreatedAt, &in.UpdatedAt,
		); err != nil {
			return nil, err
		}
		in.Services = []string(services)
		_ = json.Unmarshal(payload, &in.Payload)
		out = append(out, in)
	}
	return out, nil
}

func (s *PostgresStore) AddChecklistItem(ctx context.Context, c *ChecklistItem) error {
	if c.ID == "" {
		c.ID = newID()
	}
	now := time.Now().UTC()
	c.CreatedAt, c.UpdatedAt = now, now
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_checklist_items (id, work_item_id, code, label, status, remarks, verified_by, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''),$8,$9,$10)`,
		c.ID, c.WorkItemID, c.Code, c.Label, c.Status, c.Remarks, c.VerifiedBy, c.CreatedBy, c.CreatedAt, c.UpdatedAt)
	return err
}

func (s *PostgresStore) UpdateChecklistItem(ctx context.Context, c *ChecklistItem) error {
	c.UpdatedAt = time.Now().UTC()
	res, err := s.db.ExecContext(ctx, `
		UPDATE wm_checklist_items SET code=$2, label=$3, status=$4, remarks=$5, verified_by=NULLIF($6,''), updated_at=$7
		WHERE id=$1 AND deleted_at IS NULL`,
		c.ID, c.Code, c.Label, c.Status, c.Remarks, c.VerifiedBy, c.UpdatedAt)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("checklist item not found")
	}
	return nil
}

func (s *PostgresStore) GetChecklistItem(ctx context.Context, id string) (*ChecklistItem, error) {
	c := &ChecklistItem{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, work_item_id, code, label, status, remarks, COALESCE(verified_by,''), created_by, created_at, updated_at
		FROM wm_checklist_items WHERE id=$1 AND deleted_at IS NULL`, id).Scan(
		&c.ID, &c.WorkItemID, &c.Code, &c.Label, &c.Status, &c.Remarks, &c.VerifiedBy, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("checklist item not found")
	}
	return c, err
}

func (s *PostgresStore) ListChecklist(ctx context.Context, workID string) ([]ChecklistItem, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, code, label, status, remarks, COALESCE(verified_by,''), created_by, created_at, updated_at
		FROM wm_checklist_items WHERE work_item_id=$1 AND deleted_at IS NULL`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ChecklistItem{}
	for rows.Next() {
		var c ChecklistItem
		if err := rows.Scan(&c.ID, &c.WorkItemID, &c.Code, &c.Label, &c.Status, &c.Remarks, &c.VerifiedBy, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func (s *PostgresStore) AddTransitionHistory(ctx context.Context, h *WorkTransitionHistory) error {
	if h.ID == "" {
		h.ID = newID()
	}
	h.CreatedAt = time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_work_transitions (id, work_item_id, from_status, to_status, action, remarks, actor_id, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		h.ID, h.WorkItemID, h.FromStatus, h.ToStatus, h.Action, h.Remarks, h.ActorID, h.CreatedAt)
	return err
}

func (s *PostgresStore) ListTransitionHistory(ctx context.Context, workID string) ([]WorkTransitionHistory, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, from_status, to_status, action, remarks, actor_id, created_at
		FROM wm_work_transitions WHERE work_item_id=$1 ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []WorkTransitionHistory{}
	for rows.Next() {
		var h WorkTransitionHistory
		if err := rows.Scan(&h.ID, &h.WorkItemID, &h.FromStatus, &h.ToStatus, &h.Action, &h.Remarks, &h.ActorID, &h.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, nil
}

func (s *PostgresStore) ApplyGateWrite(ctx context.Context, g GateWrite) error {
	if g.Work == nil || g.ExpectedStatus == "" {
		return fmt.Errorf("gate write requires work and expected status")
	}
	stampGateWrite(&g)
	w := g.Work

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var lockedStatus string
	err = tx.QueryRowContext(ctx, `
		SELECT status FROM wm_work_items WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, w.ID).Scan(&lockedStatus)
	if err == sql.ErrNoRows {
		return fmt.Errorf("work item not found")
	}
	if err != nil {
		return err
	}
	if NormalizePracticeStatus(lockedStatus) != NormalizePracticeStatus(g.ExpectedStatus) {
		return ErrStatusConflict
	}

	res, err := tx.ExecContext(ctx, `
		UPDATE wm_work_items SET
			title=$2, description=$3, priority=$4, status=$5, due_date=$6,
			assigned_by=$7, assigned_to=$8, client_id=$9, client_name=$10, department=$11, tags=$12,
			estimated_hours=$13, actual_hours=$14, completion_pct=$15, parent_id=NULLIF($16,''),
			updated_by=$17, updated_at=$18,
			company_id=NULLIF($19,''), engagement_id=NULLIF($20,''), work_type=$21, period_key=$22, fy=$23,
			overlay=$24, risk_class=$25, owner_ca_id=$26, tl_id=$27, assignee_id=$28,
			delegated_close=$29, requires_partner_signoff=$30
		WHERE id=$1 AND deleted_at IS NULL AND status=$31`,
		w.ID, w.Title, w.Description, w.Priority, w.Status, nullTime(w.DueDate),
		w.AssignedBy, w.AssignedTo, nullStr(w.ClientID), w.ClientName, w.Department, pq.Array(w.Tags),
		w.EstimatedHours, w.ActualHours, w.CompletionPct, w.ParentID, w.UpdatedBy, w.UpdatedAt,
		w.CompanyID, w.EngagementID, w.WorkType, w.PeriodKey, w.FY,
		w.Overlay, w.RiskClass, w.OwnerCAID, w.TlID, w.AssigneeID,
		w.DelegatedClose, w.RequiresPartnerSignoff, g.ExpectedStatus,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrStatusConflict
	}

	if g.Transition != nil {
		h := g.Transition
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO wm_work_transitions (id, work_item_id, from_status, to_status, action, remarks, actor_id, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			h.ID, h.WorkItemID, h.FromStatus, h.ToStatus, h.Action, h.Remarks, h.ActorID, h.CreatedAt); err != nil {
			return err
		}
	}
	for i := range g.Activities {
		a := &g.Activities[i]
		meta, _ := json.Marshal(a.Metadata)
		if a.Metadata == nil {
			meta = []byte("{}")
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO wm_activity (id, work_item_id, action, summary, actor_id, actor_name, metadata, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			a.ID, a.WorkItemID, a.Action, a.Summary, a.ActorID, a.ActorName, meta, a.CreatedAt); err != nil {
			return err
		}
	}
	for i := range g.Audits {
		a := &g.Audits[i]
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO wm_audit (id, work_item_id, entity_type, entity_id, field_name, old_value, new_value, user_id, ip_address, user_agent, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			a.ID, nullStr(a.WorkItemID), a.EntityType, a.EntityID, a.FieldName, a.OldValue, a.NewValue, a.UserID, a.IPAddress, a.UserAgent, a.CreatedAt); err != nil {
			return err
		}
	}
	if g.Notification != nil && g.Notification.UserID != "" {
		n := g.Notification
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO wm_notifications (id, user_id, work_item_id, kind, title, body, created_at)
			VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7)`,
			n.ID, n.UserID, n.WorkItemID, n.Kind, n.Title, n.Body, n.CreatedAt); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *PostgresStore) ApproveIntakeAtomic(ctx context.Context, eng *Engagement, in *Intake, expectedStatus string) error {
	if eng == nil || in == nil || expectedStatus == "" {
		return fmt.Errorf("approve intake requires engagement, intake, and expected status")
	}
	if eng.ID == "" {
		eng.ID = newID()
	}
	now := time.Now().UTC()
	eng.CreatedAt, eng.UpdatedAt = now, now
	if eng.Services == nil {
		eng.Services = []string{}
	}
	in.UpdatedAt = now
	if in.Payload == nil {
		in.Payload = map[string]any{}
	}
	payload, _ := json.Marshal(in.Payload)

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var locked string
	err = tx.QueryRowContext(ctx, `
		SELECT status FROM wm_intakes WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, in.ID).Scan(&locked)
	if err == sql.ErrNoRows {
		return fmt.Errorf("intake not found")
	}
	if err != nil {
		return err
	}
	if locked != expectedStatus {
		return ErrIntakeConflict
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO wm_engagements (id, client_id, company_id, owner_ca_id, services, status, fy, title, created_by, updated_by, created_at, updated_at)
		VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		eng.ID, eng.ClientID, eng.CompanyID, eng.OwnerCAID, pq.Array(eng.Services), eng.Status, eng.FY, eng.Title,
		eng.CreatedBy, eng.UpdatedBy, eng.CreatedAt, eng.UpdatedAt); err != nil {
		return err
	}

	res, err := tx.ExecContext(ctx, `
		UPDATE wm_intakes SET status=$2, source=$3, contact_name=$4, contact_phone=$5, contact_email=$6, services=$7, notes=$8, payload=$9,
			approved_by=$10, rejected_by=$11, reject_remarks=$12, client_id=NULLIF($13,''), company_id=NULLIF($14,''),
			engagement_id=NULLIF($15,''), owner_ca_id=NULLIF($16,''), updated_at=$17
		WHERE id=$1 AND deleted_at IS NULL AND status=$18`,
		in.ID, in.Status, in.Source, in.ContactName, in.ContactPhone, in.ContactEmail, pq.Array(in.Services), in.Notes, payload,
		nullStr(in.ApprovedBy), nullStr(in.RejectedBy), in.RejectRemarks, in.ClientID, in.CompanyID, in.EngagementID, in.OwnerCAID, in.UpdatedAt,
		expectedStatus)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrIntakeConflict
	}
	return tx.Commit()
}
