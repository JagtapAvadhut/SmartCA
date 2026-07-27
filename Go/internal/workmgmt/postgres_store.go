package workmgmt

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
)

// PostgresStore persists work management data in normalized tables (migration 006).
type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) CreateWork(ctx context.Context, w *WorkItem) error {
	if w.ID == "" {
		w.ID = newID()
	}
	now := time.Now().UTC()
	w.CreatedAt, w.UpdatedAt = now, now
	if w.CreatedDate.IsZero() {
		w.CreatedDate = now
	}
	if w.Tags == nil {
		w.Tags = []string{}
	}
	if w.AssigneeID == "" {
		w.AssigneeID = w.AssignedTo
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_work_items (
			id, title, description, priority, status, due_date, created_date,
			assigned_by, assigned_to, client_id, client_name, department, tags,
			estimated_hours, actual_hours, completion_pct, parent_id, created_by, updated_by, created_at, updated_at,
			company_id, engagement_id, work_type, period_key, fy, overlay, risk_class,
			owner_ca_id, tl_id, assignee_id, delegated_close, requires_partner_signoff
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NULLIF($17,''),$18,$19,$20,$21,
			NULLIF($22,''),NULLIF($23,''),$24,$25,$26,$27,$28,$29,$30,$31,$32,$33
		)`,
		w.ID, w.Title, w.Description, w.Priority, w.Status, nullTime(w.DueDate), w.CreatedDate,
		w.AssignedBy, w.AssignedTo, nullStr(w.ClientID), w.ClientName, w.Department, pq.Array(w.Tags),
		w.EstimatedHours, w.ActualHours, w.CompletionPct, w.ParentID, w.CreatedBy, w.UpdatedBy, w.CreatedAt, w.UpdatedAt,
		w.CompanyID, w.EngagementID, w.WorkType, w.PeriodKey, w.FY, w.Overlay, w.RiskClass,
		w.OwnerCAID, w.TlID, w.AssigneeID, w.DelegatedClose, w.RequiresPartnerSignoff,
	)
	return err
}

func (s *PostgresStore) UpdateWork(ctx context.Context, w *WorkItem) error {
	w.UpdatedAt = time.Now().UTC()
	if w.AssigneeID == "" {
		w.AssigneeID = w.AssignedTo
	}
	res, err := s.db.ExecContext(ctx, `
		UPDATE wm_work_items SET
			title=$2, description=$3, priority=$4, status=$5, due_date=$6,
			assigned_by=$7, assigned_to=$8, client_id=$9, client_name=$10, department=$11, tags=$12,
			estimated_hours=$13, actual_hours=$14, completion_pct=$15, parent_id=NULLIF($16,''),
			updated_by=$17, updated_at=$18,
			company_id=NULLIF($19,''), engagement_id=NULLIF($20,''), work_type=$21, period_key=$22, fy=$23,
			overlay=$24, risk_class=$25, owner_ca_id=$26, tl_id=$27, assignee_id=$28,
			delegated_close=$29, requires_partner_signoff=$30
		WHERE id=$1 AND deleted_at IS NULL`,
		w.ID, w.Title, w.Description, w.Priority, w.Status, nullTime(w.DueDate),
		w.AssignedBy, w.AssignedTo, nullStr(w.ClientID), w.ClientName, w.Department, pq.Array(w.Tags),
		w.EstimatedHours, w.ActualHours, w.CompletionPct, w.ParentID, w.UpdatedBy, w.UpdatedAt,
		w.CompanyID, w.EngagementID, w.WorkType, w.PeriodKey, w.FY,
		w.Overlay, w.RiskClass, w.OwnerCAID, w.TlID, w.AssigneeID,
		w.DelegatedClose, w.RequiresPartnerSignoff,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("work item not found")
	}
	return nil
}

func (s *PostgresStore) GetWork(ctx context.Context, id string, includeDeleted bool) (*WorkItem, error) {
	q := `SELECT id, title, description, priority, status, due_date, created_date,
		assigned_by, assigned_to, COALESCE(client_id,''), client_name, department, tags,
		estimated_hours, actual_hours, completion_pct, COALESCE(parent_id,''), created_by, updated_by,
		created_at, updated_at, deleted_at, COALESCE(deleted_by,''),
		COALESCE(company_id,''), COALESCE(engagement_id,''), COALESCE(work_type,''), COALESCE(period_key,''),
		COALESCE(fy,''), COALESCE(overlay,''), COALESCE(risk_class,'medium'),
		COALESCE(owner_ca_id,''), COALESCE(tl_id,''), COALESCE(assignee_id,''),
		COALESCE(delegated_close,false), COALESCE(requires_partner_signoff,false)
		FROM wm_work_items WHERE id=$1`
	if !includeDeleted {
		q += ` AND deleted_at IS NULL`
	}
	w := &WorkItem{}
	var due, del sql.NullTime
	var tags pq.StringArray
	err := s.db.QueryRowContext(ctx, q, id).Scan(
		&w.ID, &w.Title, &w.Description, &w.Priority, &w.Status, &due, &w.CreatedDate,
		&w.AssignedBy, &w.AssignedTo, &w.ClientID, &w.ClientName, &w.Department, &tags,
		&w.EstimatedHours, &w.ActualHours, &w.CompletionPct, &w.ParentID, &w.CreatedBy, &w.UpdatedBy,
		&w.CreatedAt, &w.UpdatedAt, &del, &w.DeletedBy,
		&w.CompanyID, &w.EngagementID, &w.WorkType, &w.PeriodKey,
		&w.FY, &w.Overlay, &w.RiskClass,
		&w.OwnerCAID, &w.TlID, &w.AssigneeID,
		&w.DelegatedClose, &w.RequiresPartnerSignoff,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("work item not found")
	}
	if err != nil {
		return nil, err
	}
	if due.Valid {
		t := due.Time
		w.DueDate = &t
	}
	if del.Valid {
		t := del.Time
		w.DeletedAt = &t
	}
	w.Tags = []string(tags)
	n, _ := s.CountChildren(ctx, w.ID)
	w.ChildCount = n
	return w, nil
}

func (s *PostgresStore) CountChildren(ctx context.Context, parentID string) (int, error) {
	var n int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM wm_work_items WHERE parent_id=$1 AND deleted_at IS NULL`, parentID).Scan(&n)
	return n, err
}

func (s *PostgresStore) ListWork(ctx context.Context, f ListFilter) (Page[WorkItem], error) {
	if f.ForceEmpty {
		return Page[WorkItem]{Items: []WorkItem{}, Page: 1, PageSize: f.PageSize}, nil
	}
	where := []string{"1=1"}
	args := []any{}
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if !f.IncludeDeleted {
		where = append(where, "deleted_at IS NULL")
	}
	if f.Status != "" {
		add("status=$%d", NormalizePracticeStatus(f.Status))
	}
	if f.Priority != "" {
		add("priority=$%d", f.Priority)
	}
	if f.AssigneeID != "" {
		args = append(args, f.AssigneeID)
		i := len(args)
		where = append(where, fmt.Sprintf("(assignee_id=$%d OR assigned_to=$%d)", i, i))
	}
	if f.OwnerCAID != "" || f.TlID != "" || len(f.ScopeDownlineIDs) > 0 {
		parts := []string{}
		if f.OwnerCAID != "" {
			args = append(args, f.OwnerCAID)
			i := len(args)
			parts = append(parts, fmt.Sprintf("(owner_ca_id=$%d OR assigned_to=$%d OR assignee_id=$%d OR created_by=$%d OR assigned_by=$%d)", i, i, i, i, i))
		}
		if f.TlID != "" {
			args = append(args, f.TlID)
			i := len(args)
			parts = append(parts, fmt.Sprintf("(tl_id=$%d OR assigned_to=$%d OR assignee_id=$%d OR created_by=$%d)", i, i, i, i))
		}
		for _, id := range f.ScopeDownlineIDs {
			args = append(args, id)
			i := len(args)
			parts = append(parts, fmt.Sprintf("(assignee_id=$%d OR assigned_to=$%d OR owner_ca_id=$%d OR tl_id=$%d)", i, i, i, i))
		}
		if len(parts) > 0 {
			where = append(where, "("+strings.Join(parts, " OR ")+")")
		}
	}
	if f.InvolvedUserID != "" {
		args = append(args, f.InvolvedUserID)
		i := len(args)
		where = append(where, fmt.Sprintf("(assigned_to=$%d OR assignee_id=$%d OR assigned_by=$%d OR created_by=$%d OR owner_ca_id=$%d OR tl_id=$%d)", i, i, i, i, i, i))
	}
	if f.ClientID != "" {
		add("client_id=$%d", f.ClientID)
	}
	if f.CompanyID != "" {
		add("company_id=$%d", f.CompanyID)
	}
	if f.EngagementID != "" {
		add("engagement_id=$%d", f.EngagementID)
	}
	if f.WorkType != "" {
		add("work_type=$%d", f.WorkType)
	}
	if f.PeriodKey != "" {
		add("period_key=$%d", f.PeriodKey)
	}
	if f.Overlay != "" {
		add("overlay=$%d", f.Overlay)
	}
	if f.Department != "" {
		add("department=$%d", f.Department)
	}
	if f.Query != "" {
		args = append(args, "%"+strings.ToLower(f.Query)+"%")
		i := len(args)
		where = append(where, fmt.Sprintf("(LOWER(title) LIKE $%d OR LOWER(description) LIKE $%d OR LOWER(client_name) LIKE $%d OR LOWER(department) LIKE $%d)", i, i, i, i))
	}
	order := "updated_at DESC"
	switch f.Sort {
	case "title":
		order = "title ASC"
	case "priority", "priority:desc":
		order = "CASE priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC"
	case "dueDate", "dueDate:asc":
		order = "due_date ASC NULLS LAST"
	}
	page, size := f.Page, f.PageSize
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 20
	}
	if size > 500 {
		size = 500
	}
	whereSQL := strings.Join(where, " AND ")
	var total int
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM wm_work_items WHERE "+whereSQL, args...).Scan(&total); err != nil {
		return Page[WorkItem]{}, err
	}
	args = append(args, size, (page-1)*size)
	lim, off := len(args)-1, len(args)
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT id, title, description, priority, status, due_date, created_date,
			assigned_by, assigned_to, COALESCE(client_id,''), client_name, department, tags,
			estimated_hours, actual_hours, completion_pct, COALESCE(parent_id,''), created_by, updated_by,
			created_at, updated_at,
			COALESCE(company_id,''), COALESCE(engagement_id,''), COALESCE(work_type,''), COALESCE(period_key,''),
			COALESCE(fy,''), COALESCE(overlay,''), COALESCE(risk_class,'medium'),
			COALESCE(owner_ca_id,''), COALESCE(tl_id,''), COALESCE(assignee_id,''),
			COALESCE(delegated_close,false), COALESCE(requires_partner_signoff,false)
		FROM wm_work_items WHERE %s ORDER BY %s LIMIT $%d OFFSET $%d`, whereSQL, order, lim, off), args...)
	if err != nil {
		return Page[WorkItem]{}, err
	}
	defer rows.Close()
	items := []WorkItem{}
	for rows.Next() {
		var w WorkItem
		var due sql.NullTime
		var tags pq.StringArray
		if err := rows.Scan(
			&w.ID, &w.Title, &w.Description, &w.Priority, &w.Status, &due, &w.CreatedDate,
			&w.AssignedBy, &w.AssignedTo, &w.ClientID, &w.ClientName, &w.Department, &tags,
			&w.EstimatedHours, &w.ActualHours, &w.CompletionPct, &w.ParentID, &w.CreatedBy, &w.UpdatedBy,
			&w.CreatedAt, &w.UpdatedAt,
			&w.CompanyID, &w.EngagementID, &w.WorkType, &w.PeriodKey,
			&w.FY, &w.Overlay, &w.RiskClass,
			&w.OwnerCAID, &w.TlID, &w.AssigneeID,
			&w.DelegatedClose, &w.RequiresPartnerSignoff,
		); err != nil {
			return Page[WorkItem]{}, err
		}
		if due.Valid {
			t := due.Time
			w.DueDate = &t
		}
		w.Tags = []string(tags)
		items = append(items, w)
	}
	tp := total / size
	if total%size != 0 {
		tp++
	}
	return Page[WorkItem]{Items: items, Total: total, Page: page, PageSize: size, TotalPages: tp}, nil
}

func (s *PostgresStore) SoftDeleteWork(ctx context.Context, id, by string) error {
	res, err := s.db.ExecContext(ctx, `UPDATE wm_work_items SET deleted_at=NOW(), deleted_by=$2, updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id, by)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("work item not found")
	}
	return nil
}

func (s *PostgresStore) RestoreWork(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `UPDATE wm_work_items SET deleted_at=NULL, deleted_by=NULL, updated_at=NOW() WHERE id=$1 AND deleted_at IS NOT NULL`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("work item not found")
	}
	return nil
}

func (s *PostgresStore) AddFollowUp(ctx context.Context, f *FollowUp) error {
	if f.ID == "" {
		f.ID = newID()
	}
	now := time.Now().UTC()
	f.CreatedAt, f.UpdatedAt = now, now
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_followups (id, work_item_id, followup_date, followup_time, created_by, notes, next_followup_date, reminder, created_at, updated_at)
		VALUES ($1,$2,$3::date,NULLIF($4,'')::time,$5,$6,NULLIF($7,'')::date,$8,$9,$10)`,
		f.ID, f.WorkItemID, f.FollowUpDate, f.FollowUpTime, f.CreatedBy, f.Notes, f.NextFollowUpDate, f.Reminder, f.CreatedAt, f.UpdatedAt)
	return err
}

func (s *PostgresStore) ListFollowUps(ctx context.Context, workID string) ([]FollowUp, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, followup_date::text, COALESCE(followup_time::text,''), created_by, notes,
			COALESCE(next_followup_date::text,''), reminder, created_at, updated_at
		FROM wm_followups WHERE work_item_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []FollowUp{}
	for rows.Next() {
		var f FollowUp
		if err := rows.Scan(&f.ID, &f.WorkItemID, &f.FollowUpDate, &f.FollowUpTime, &f.CreatedBy, &f.Notes, &f.NextFollowUpDate, &f.Reminder, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, nil
}

func (s *PostgresStore) SoftDeleteFollowUp(ctx context.Context, id, by string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_followups SET deleted_at=NOW(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL`, id, by)
	return err
}

func (s *PostgresStore) RestoreFollowUp(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_followups SET deleted_at=NULL, deleted_by=NULL, updated_at=NOW() WHERE id=$1 AND deleted_at IS NOT NULL`, id)
	return err
}

func (s *PostgresStore) UpdateFollowUp(ctx context.Context, f *FollowUp) error {
	f.UpdatedAt = time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE wm_followups SET followup_date=$2::date, followup_time=NULLIF($3,'')::time, notes=$4,
		next_followup_date=NULLIF($5,'')::date, reminder=$6, updated_at=$7
		WHERE id=$1 AND deleted_at IS NULL`,
		f.ID, f.FollowUpDate, f.FollowUpTime, f.Notes, f.NextFollowUpDate, f.Reminder, f.UpdatedAt)
	return err
}

func (s *PostgresStore) AddCall(ctx context.Context, c *CallLog) error {
	if c.ID == "" {
		c.ID = newID()
	}
	now := time.Now().UTC()
	c.CreatedAt, c.UpdatedAt = now, now
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_call_logs (id, work_item_id, call_date, call_time, direction, duration_minutes, person_spoken_to, designation, phone_number, summary, detailed_notes, action_items, next_call_date, created_by, created_at, updated_at)
		VALUES ($1,$2,$3::date,NULLIF($4,'')::time,$5,$6,$7,$8,$9,$10,$11,$12,NULLIF($13,'')::date,$14,$15,$16)`,
		c.ID, c.WorkItemID, c.CallDate, c.CallTime, c.Direction, c.DurationMinutes, c.PersonSpokenTo, c.Designation, c.PhoneNumber, c.Summary, c.DetailedNotes, c.ActionItems, c.NextCallDate, c.CreatedBy, c.CreatedAt, c.UpdatedAt)
	return err
}

func (s *PostgresStore) ListCalls(ctx context.Context, workID string) ([]CallLog, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, call_date::text, COALESCE(call_time::text,''), direction, duration_minutes, person_spoken_to, designation, phone_number, summary, detailed_notes, action_items, COALESCE(next_call_date::text,''), created_by, created_at, updated_at
		FROM wm_call_logs WHERE work_item_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CallLog{}
	for rows.Next() {
		var c CallLog
		if err := rows.Scan(&c.ID, &c.WorkItemID, &c.CallDate, &c.CallTime, &c.Direction, &c.DurationMinutes, &c.PersonSpokenTo, &c.Designation, &c.PhoneNumber, &c.Summary, &c.DetailedNotes, &c.ActionItems, &c.NextCallDate, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func (s *PostgresStore) SoftDeleteCall(ctx context.Context, id, by string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_call_logs SET deleted_at=NOW(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL`, id, by)
	return err
}

func (s *PostgresStore) RestoreCall(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_call_logs SET deleted_at=NULL, deleted_by=NULL, updated_at=NOW() WHERE id=$1 AND deleted_at IS NOT NULL`, id)
	return err
}

func (s *PostgresStore) AddEmail(ctx context.Context, e *EmailLog) error {
	if e.ID == "" {
		e.ID = newID()
	}
	now := time.Now().UTC()
	e.CreatedAt, e.UpdatedAt = now, now
	if e.Attachments == nil {
		e.Attachments = []string{}
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_email_logs (id, work_item_id, email_date, email_time, from_addr, to_addr, cc_addr, subject, summary, attachments, status, created_by, created_at, updated_at)
		VALUES ($1,$2,$3::date,NULLIF($4,'')::time,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		e.ID, e.WorkItemID, e.EmailDate, e.EmailTime, e.From, e.To, e.CC, e.Subject, e.Summary, pq.Array(e.Attachments), e.Status, e.CreatedBy, e.CreatedAt, e.UpdatedAt)
	return err
}

func (s *PostgresStore) ListEmails(ctx context.Context, workID string) ([]EmailLog, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, email_date::text, COALESCE(email_time::text,''), from_addr, to_addr, cc_addr, subject, summary, attachments, status, created_by, created_at, updated_at
		FROM wm_email_logs WHERE work_item_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []EmailLog{}
	for rows.Next() {
		var e EmailLog
		var atts pq.StringArray
		if err := rows.Scan(&e.ID, &e.WorkItemID, &e.EmailDate, &e.EmailTime, &e.From, &e.To, &e.CC, &e.Subject, &e.Summary, &atts, &e.Status, &e.CreatedBy, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		e.Attachments = []string(atts)
		out = append(out, e)
	}
	return out, nil
}

func (s *PostgresStore) SoftDeleteEmail(ctx context.Context, id, by string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_email_logs SET deleted_at=NOW(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL`, id, by)
	return err
}

func (s *PostgresStore) RestoreEmail(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_email_logs SET deleted_at=NULL, deleted_by=NULL, updated_at=NOW() WHERE id=$1 AND deleted_at IS NOT NULL`, id)
	return err
}

func (s *PostgresStore) AddMeeting(ctx context.Context, m *MeetingLog) error {
	if m.ID == "" {
		m.ID = newID()
	}
	now := time.Now().UTC()
	m.CreatedAt, m.UpdatedAt = now, now
	if m.Participants == nil {
		m.Participants = []string{}
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_meeting_logs (id, work_item_id, meeting_date, meeting_time, location, online_link, participants, discussion_notes, decisions, action_items, created_by, created_at, updated_at)
		VALUES ($1,$2,$3::date,NULLIF($4,'')::time,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		m.ID, m.WorkItemID, m.MeetingDate, m.MeetingTime, m.Location, m.OnlineLink, pq.Array(m.Participants), m.DiscussionNotes, m.Decisions, m.ActionItems, m.CreatedBy, m.CreatedAt, m.UpdatedAt)
	return err
}

func (s *PostgresStore) ListMeetings(ctx context.Context, workID string) ([]MeetingLog, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, meeting_date::text, COALESCE(meeting_time::text,''), location, online_link, participants, discussion_notes, decisions, action_items, created_by, created_at, updated_at
		FROM wm_meeting_logs WHERE work_item_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MeetingLog{}
	for rows.Next() {
		var m MeetingLog
		var parts pq.StringArray
		if err := rows.Scan(&m.ID, &m.WorkItemID, &m.MeetingDate, &m.MeetingTime, &m.Location, &m.OnlineLink, &parts, &m.DiscussionNotes, &m.Decisions, &m.ActionItems, &m.CreatedBy, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		m.Participants = []string(parts)
		out = append(out, m)
	}
	return out, nil
}

func (s *PostgresStore) SoftDeleteMeeting(ctx context.Context, id, by string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_meeting_logs SET deleted_at=NOW(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL`, id, by)
	return err
}

func (s *PostgresStore) RestoreMeeting(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_meeting_logs SET deleted_at=NULL, deleted_by=NULL, updated_at=NOW() WHERE id=$1 AND deleted_at IS NOT NULL`, id)
	return err
}

func (s *PostgresStore) AddNote(ctx context.Context, n *Note) error {
	if n.ID == "" {
		n.ID = newID()
	}
	now := time.Now().UTC()
	n.CreatedAt, n.UpdatedAt = now, now
	if n.AttachmentIDs == nil {
		n.AttachmentIDs = []string{}
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_notes (id, work_item_id, body, format, attachment_ids, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		n.ID, n.WorkItemID, n.Body, n.Format, pq.Array(n.AttachmentIDs), n.CreatedBy, n.CreatedAt, n.UpdatedAt)
	return err
}

func (s *PostgresStore) UpdateNote(ctx context.Context, n *Note) error {
	now := time.Now().UTC()
	n.EditedAt, n.UpdatedAt = &now, now
	_, err := s.db.ExecContext(ctx, `UPDATE wm_notes SET body=$2, format=$3, attachment_ids=$4, edited_at=$5, updated_at=$5 WHERE id=$1 AND deleted_at IS NULL`,
		n.ID, n.Body, n.Format, pq.Array(n.AttachmentIDs), now)
	return err
}

func (s *PostgresStore) ListNotes(ctx context.Context, workID string) ([]Note, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, body, format, attachment_ids, created_by, created_at, edited_at, updated_at
		FROM wm_notes WHERE work_item_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Note{}
	for rows.Next() {
		var n Note
		var atts pq.StringArray
		var edited sql.NullTime
		if err := rows.Scan(&n.ID, &n.WorkItemID, &n.Body, &n.Format, &atts, &n.CreatedBy, &n.CreatedAt, &edited, &n.UpdatedAt); err != nil {
			return nil, err
		}
		n.AttachmentIDs = []string(atts)
		if edited.Valid {
			t := edited.Time
			n.EditedAt = &t
		}
		out = append(out, n)
	}
	return out, nil
}

func (s *PostgresStore) SoftDeleteNote(ctx context.Context, id, by string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_notes SET deleted_at=NOW(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL`, id, by)
	return err
}

func (s *PostgresStore) RestoreNote(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_notes SET deleted_at=NULL, deleted_by=NULL, updated_at=NOW() WHERE id=$1 AND deleted_at IS NOT NULL`, id)
	return err
}

func (s *PostgresStore) AddComment(ctx context.Context, c *Comment) error {
	if c.ID == "" {
		c.ID = newID()
	}
	now := time.Now().UTC()
	c.CreatedAt, c.UpdatedAt = now, now
	if c.Mentions == nil {
		c.Mentions = []string{}
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_comments (id, work_item_id, body, mentions, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		c.ID, c.WorkItemID, c.Body, pq.Array(c.Mentions), c.CreatedBy, c.CreatedAt, c.UpdatedAt)
	return err
}

func (s *PostgresStore) ListComments(ctx context.Context, workID string) ([]Comment, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, body, mentions, created_by, created_at, updated_at
		FROM wm_comments WHERE work_item_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Comment{}
	for rows.Next() {
		var c Comment
		var mentions pq.StringArray
		if err := rows.Scan(&c.ID, &c.WorkItemID, &c.Body, &mentions, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.Mentions = []string(mentions)
		out = append(out, c)
	}
	return out, nil
}

func (s *PostgresStore) SoftDeleteComment(ctx context.Context, id, by string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_comments SET deleted_at=NOW(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL`, id, by)
	return err
}

func (s *PostgresStore) RestoreComment(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_comments SET deleted_at=NULL, deleted_by=NULL, updated_at=NOW() WHERE id=$1 AND deleted_at IS NOT NULL`, id)
	return err
}

func (s *PostgresStore) AddAttachment(ctx context.Context, a *Attachment) error {
	if a.ID == "" {
		a.ID = newID()
	}
	now := time.Now().UTC()
	a.CreatedAt, a.UpdatedAt = now, now
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_attachments (id, work_item_id, file_name, content_type, size_bytes, storage_path, kind, uploaded_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		a.ID, a.WorkItemID, a.FileName, a.ContentType, a.SizeBytes, a.StoragePath, a.Kind, a.UploadedBy, a.CreatedAt, a.UpdatedAt)
	return err
}

func (s *PostgresStore) ListAttachments(ctx context.Context, workID string) ([]Attachment, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, file_name, content_type, size_bytes, storage_path, kind, uploaded_by, created_at, updated_at
		FROM wm_attachments WHERE work_item_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Attachment{}
	for rows.Next() {
		var a Attachment
		if err := rows.Scan(&a.ID, &a.WorkItemID, &a.FileName, &a.ContentType, &a.SizeBytes, &a.StoragePath, &a.Kind, &a.UploadedBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, nil
}

func (s *PostgresStore) GetAttachment(ctx context.Context, id string, includeDeleted bool) (*Attachment, error) {
	q := `SELECT id, work_item_id, file_name, content_type, size_bytes, storage_path, kind, uploaded_by, created_at, updated_at, deleted_at, COALESCE(deleted_by,'') FROM wm_attachments WHERE id=$1`
	if !includeDeleted {
		q += ` AND deleted_at IS NULL`
	}
	var a Attachment
	var del sql.NullTime
	err := s.db.QueryRowContext(ctx, q, id).Scan(&a.ID, &a.WorkItemID, &a.FileName, &a.ContentType, &a.SizeBytes, &a.StoragePath, &a.Kind, &a.UploadedBy, &a.CreatedAt, &a.UpdatedAt, &del, &a.DeletedBy)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("attachment not found")
	}
	if err != nil {
		return nil, err
	}
	if del.Valid {
		t := del.Time
		a.DeletedAt = &t
	}
	return &a, nil
}

func (s *PostgresStore) SoftDeleteAttachment(ctx context.Context, id, by string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_attachments SET deleted_at=NOW(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL`, id, by)
	return err
}

func (s *PostgresStore) RestoreAttachment(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE wm_attachments SET deleted_at=NULL, deleted_by=NULL WHERE id=$1 AND deleted_at IS NOT NULL`, id)
	return err
}

func (s *PostgresStore) AddActivity(ctx context.Context, a *ActivityEvent) error {
	if a.ID == "" {
		a.ID = newID()
	}
	a.CreatedAt = time.Now().UTC()
	meta, _ := json.Marshal(a.Metadata)
	if a.Metadata == nil {
		meta = []byte("{}")
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_activity (id, work_item_id, action, summary, actor_id, actor_name, metadata, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		a.ID, a.WorkItemID, a.Action, a.Summary, a.ActorID, a.ActorName, meta, a.CreatedAt)
	return err
}

func (s *PostgresStore) ListActivity(ctx context.Context, workID string) ([]ActivityEvent, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, action, summary, actor_id, actor_name, metadata, created_at
		FROM wm_activity WHERE work_item_id=$1 ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanActivity(rows)
}

func (s *PostgresStore) ListGlobalActivity(ctx context.Context, limit int) ([]ActivityEvent, error) {
	if limit < 1 {
		limit = 100
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, work_item_id, action, summary, actor_id, actor_name, metadata, created_at
		FROM wm_activity ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanActivity(rows)
}

func scanActivity(rows *sql.Rows) ([]ActivityEvent, error) {
	out := []ActivityEvent{}
	for rows.Next() {
		var a ActivityEvent
		var meta []byte
		if err := rows.Scan(&a.ID, &a.WorkItemID, &a.Action, &a.Summary, &a.ActorID, &a.ActorName, &meta, &a.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(meta, &a.Metadata)
		out = append(out, a)
	}
	return out, nil
}

func (s *PostgresStore) AddAudit(ctx context.Context, a *AuditEntry) error {
	if a.ID == "" {
		a.ID = newID()
	}
	a.CreatedAt = time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_audit (id, work_item_id, entity_type, entity_id, field_name, old_value, new_value, user_id, ip_address, user_agent, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		a.ID, nullStr(a.WorkItemID), a.EntityType, a.EntityID, a.FieldName, a.OldValue, a.NewValue, a.UserID, a.IPAddress, a.UserAgent, a.CreatedAt)
	return err
}

func (s *PostgresStore) ListAudit(ctx context.Context, workID string) ([]AuditEntry, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, COALESCE(work_item_id,''), entity_type, entity_id, field_name, old_value, new_value, user_id, ip_address, user_agent, created_at
		FROM wm_audit WHERE work_item_id=$1 ORDER BY created_at DESC`, workID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AuditEntry{}
	for rows.Next() {
		var a AuditEntry
		if err := rows.Scan(&a.ID, &a.WorkItemID, &a.EntityType, &a.EntityID, &a.FieldName, &a.OldValue, &a.NewValue, &a.UserID, &a.IPAddress, &a.UserAgent, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, nil
}

func (s *PostgresStore) AddNotification(ctx context.Context, n *Notification) error {
	if n.ID == "" {
		n.ID = newID()
	}
	n.CreatedAt = time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO wm_notifications (id, user_id, work_item_id, kind, title, body, created_at)
		VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7)`,
		n.ID, n.UserID, n.WorkItemID, n.Kind, n.Title, n.Body, n.CreatedAt)
	return err
}

func (s *PostgresStore) ListNotifications(ctx context.Context, userID string) ([]Notification, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, COALESCE(work_item_id,''), kind, title, body, read_at, created_at
		FROM wm_notifications WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Notification{}
	for rows.Next() {
		var n Notification
		var read sql.NullTime
		if err := rows.Scan(&n.ID, &n.UserID, &n.WorkItemID, &n.Kind, &n.Title, &n.Body, &read, &n.CreatedAt); err != nil {
			return nil, err
		}
		if read.Valid {
			t := read.Time
			n.ReadAt = &t
		}
		out = append(out, n)
	}
	return out, nil
}

func (s *PostgresStore) Dashboard(ctx context.Context, actor Actor, today string) (DashboardStats, error) {
	stats := DashboardStats{
		EmployeePerformance:   map[string]int{},
		CAPerformance:         map[string]int{},
		TeamLeaderPerformance: map[string]int{},
		DepartmentSummary:     map[string]int{},
	}
	where := "deleted_at IS NULL"
	args := []any{}
	switch actor.Hierarchy {
	case RoleEmployee:
		args = append(args, actor.ID)
		where += fmt.Sprintf(" AND assigned_to=$%d", len(args))
	case RoleCA, RoleTeamLeader:
		args = append(args, actor.ID)
		i := len(args)
		where += fmt.Sprintf(" AND (assigned_to=$%d OR assigned_by=$%d OR created_by=$%d)", i, i, i)
	}
	// Practice-aware: completed = CLOSED (+ legacy completed); pending = not CLOSED/CANCELLED;
	// queue counts expose verify/close backlog (BUG-0009).
	q := fmt.Sprintf(`
		SELECT
			COUNT(*) FILTER (WHERE UPPER(TRIM(status)) NOT IN ('COMPLETED','CLOSED','CANCELLED')) AS pending,
			COUNT(*) FILTER (WHERE UPPER(TRIM(status)) IN ('COMPLETED','CLOSED')) AS completed,
			COUNT(*) FILTER (WHERE UPPER(TRIM(status)) NOT IN ('COMPLETED','CLOSED','CANCELLED') AND due_date < NOW()) AS overdue,
			COUNT(*) FILTER (WHERE due_date::date = $%d::date) AS todays_work,
			COUNT(*) FILTER (WHERE assigned_to = $%d) AS my_work,
			COUNT(*) FILTER (WHERE UPPER(TRIM(status)) IN ('READY_FOR_TL_VERIFY','REVIEW')) AS ready_for_tl_verify,
			COUNT(*) FILTER (WHERE UPPER(TRIM(status)) = 'READY_FOR_CA_VERIFY') AS ready_for_ca_verify,
			COUNT(*) FILTER (WHERE UPPER(TRIM(status)) = 'READY_FOR_MANAGER_CLOSE') AS ready_for_manager_close
		FROM wm_work_items WHERE %s`, len(args)+1, len(args)+2, where)
	args = append(args, today, actor.ID)
	err := s.db.QueryRowContext(ctx, q, args...).Scan(
		&stats.Pending, &stats.Completed, &stats.Overdue, &stats.TodaysWork, &stats.MyWork,
		&stats.ReadyForTLVerify, &stats.ReadyForCAVerify, &stats.ReadyForManagerClose,
	)
	if err != nil {
		return stats, err
	}
	stats.PendingTasks = stats.Pending
	stats.CompletedTasks = stats.Completed
	stats.AwaitingClose = stats.ReadyForManagerClose

	deptArgs := []any{}
	deptWhere := "deleted_at IS NULL"
	switch actor.Hierarchy {
	case RoleEmployee:
		deptArgs = append(deptArgs, actor.ID)
		deptWhere += fmt.Sprintf(" AND assigned_to=$%d", len(deptArgs))
	case RoleCA, RoleTeamLeader:
		deptArgs = append(deptArgs, actor.ID)
		i := len(deptArgs)
		deptWhere += fmt.Sprintf(" AND (assigned_to=$%d OR assigned_by=$%d OR created_by=$%d)", i, i, i)
	}
	rows, err := s.db.QueryContext(ctx, "SELECT COALESCE(department,'(none)'), COUNT(*) FROM wm_work_items WHERE "+deptWhere+" GROUP BY department", deptArgs...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d string
			var n int
			if rows.Scan(&d, &n) == nil {
				stats.DepartmentSummary[d] = n
			}
		}
	}
	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM wm_followups WHERE deleted_at IS NULL AND followup_date=$1::date`, today).Scan(&stats.TodaysFollowUps)
	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM wm_call_logs WHERE deleted_at IS NULL AND next_call_date IS NOT NULL AND next_call_date >= $1::date`, today).Scan(&stats.UpcomingCalls)
	return stats, nil
}

func (s *PostgresStore) Search(ctx context.Context, actor Actor, q string, limit int) ([]WorkItem, error) {
	page, err := s.ListWork(ctx, ListFilter{Page: 1, PageSize: limit, Query: q})
	if err != nil {
		return nil, err
	}
	out := make([]WorkItem, 0, len(page.Items))
	for _, w := range page.Items {
		if actor.Hierarchy == RoleEmployee && w.AssignedTo != actor.ID {
			continue
		}
		out = append(out, w)
	}
	return out, nil
}

func nullTime(t *time.Time) any {
	if t == nil {
		return nil
	}
	return *t
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
