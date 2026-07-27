package workmgmt

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"time"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
)

// Service implements work-management business rules + RBAC.
type Service struct {
	store Store
}

func NewService(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) has(actor Actor, perm string) bool {
	for _, p := range actor.Permissions {
		if p == perm {
			return true
		}
	}
	// Hierarchy fallback when permissions not hydrated.
	for _, p := range PermissionsForRole(actor.Hierarchy) {
		if p == perm {
			return true
		}
	}
	return false
}

func (s *Service) require(actor Actor, perm string) error {
	if s.has(actor, perm) {
		return nil
	}
	return apperrors.Forbidden("insufficient work permissions: " + perm)
}

func normalizePriority(p string) string {
	switch strings.ToLower(strings.TrimSpace(p)) {
	case "low", "medium", "high", "urgent":
		return strings.ToLower(p)
	default:
		return "medium"
	}
}

func normalizeStatus(st string) string {
	return NormalizePracticeStatus(st)
}

func (s *Service) auditField(ctx context.Context, actor Actor, workID, entityType, entityID, field, oldV, newV string) {
	_ = s.store.AddAudit(ctx, &AuditEntry{
		WorkItemID: workID,
		EntityType: entityType,
		EntityID:   entityID,
		FieldName:  field,
		OldValue:   oldV,
		NewValue:   newV,
		UserID:     actor.ID,
		IPAddress:  actor.IP,
		UserAgent:  actor.UserAgent,
	})
}

func (s *Service) activity(ctx context.Context, actor Actor, workID, action, summary string, meta map[string]any) {
	_ = s.store.AddActivity(ctx, &ActivityEvent{
		WorkItemID: workID,
		Action:     action,
		Summary:    summary,
		ActorID:    actor.ID,
		ActorName:  actor.Name,
		Metadata:   meta,
	})
}

func (s *Service) notify(ctx context.Context, userID, workID, kind, title, body string) {
	if userID == "" {
		return
	}
	_ = s.store.AddNotification(ctx, &Notification{
		UserID:     userID,
		WorkItemID: workID,
		Kind:       kind,
		Title:      title,
		Body:       body,
	})
}

// CreateWork creates a work item. Assignee is optional: Manager/CA (and other
// creators with work.create) may open unassigned OPEN / DOCUMENT_PENDING work
// and fill assignee later via AssignSlot. When assignedTo/assigneeId is set,
// assign permission and CanAssignTo(assigneeRole) still apply. Employees lack
// work.create and remain rejected.
func (s *Service) CreateWork(ctx context.Context, actor Actor, in *WorkItem, assigneeRole string) (*WorkItem, error) {
	if err := s.require(actor, PermCreate); err != nil {
		return nil, err
	}
	if IsSupportRole(actor.Hierarchy) {
		return nil, apperrors.Forbidden("support roles cannot create client work")
	}
	if strings.TrimSpace(in.Title) == "" {
		return nil, apperrors.Validation("title is required")
	}
	assignee := firstNonEmptyStr(in.AssigneeID, in.AssignedTo)
	if assignee != "" {
		in.AssignedTo = assignee
		if in.AssigneeID == "" {
			in.AssigneeID = assignee
		}
		if err := s.require(actor, PermAssign); err != nil {
			return nil, err
		}
		if !CanAssignTo(actor.Hierarchy, assigneeRole) {
			return nil, apperrors.Forbidden("cannot assign work to this role")
		}
	} else {
		in.AssignedTo = ""
		in.AssigneeID = ""
	}
	// Corporate compliance requires company_id when work_type implies GST/ROC etc.
	wt := strings.ToUpper(strings.TrimSpace(in.WorkType))
	if (strings.Contains(wt, "GST") || strings.Contains(wt, "GSTR") || strings.Contains(wt, "ROC")) &&
		strings.TrimSpace(in.CompanyID) == "" {
		return nil, apperrors.Validation("companyId is required for corporate compliance work")
	}
	if in.ParentID != "" {
		if _, err := s.store.GetWork(ctx, in.ParentID, false); err != nil {
			return nil, apperrors.NotFound("parent work not found")
		}
	}
	in.Priority = normalizePriority(in.Priority)
	in.Status = normalizeStatus(in.Status)
	if assignee == "" {
		st := NormalizePracticeStatus(in.Status)
		if st != StatusOpen && st != StatusDocumentPending {
			in.Status = StatusOpen
		} else {
			in.Status = st
		}
	}
	in.RiskClass = NormalizeRiskClass(in.RiskClass)
	in.Overlay = NormalizeOverlay(in.Overlay)
	in.AssignedBy = actor.ID
	in.AssignedByName = actor.Name
	in.CreatedBy = actor.ID
	in.UpdatedBy = actor.ID
	ApplyOwnershipTriadDefaults(actor, in, assigneeRole)
	if in.Tags == nil {
		in.Tags = []string{}
	}
	if err := s.store.CreateWork(ctx, in); err != nil {
		mapped := mapGateErr(err)
		var ae *apperrors.AppError
		if errors.As(mapped, &ae) {
			return nil, ae
		}
		return nil, apperrors.Internal("failed to create work", err)
	}
	s.activity(ctx, actor, in.ID, ActionCreated, "Work created: "+in.Title, nil)
	if assignee != "" {
		s.activity(ctx, actor, in.ID, ActionAssigned, "Assigned to "+in.AssignedToName, map[string]any{"to": in.AssignedTo})
		s.notify(ctx, in.AssignedTo, in.ID, "assignment", "New work assigned", in.Title)
	}
	s.auditField(ctx, actor, in.ID, "work_item", in.ID, "status", "", in.Status)
	return s.store.GetWork(ctx, in.ID, false)
}

// WorkPatch is a partial update payload (nil pointers = unchanged).
// Status may only move among free operational statuses; gate transitions use dedicated APIs.
type WorkPatch struct {
	Title          *string    `json:"title"`
	Description    *string    `json:"description"`
	Priority       *string    `json:"priority"`
	Status         *string    `json:"status"`
	DueDate        *time.Time `json:"dueDate"`
	ClientID       *string    `json:"clientId"`
	ClientName     *string    `json:"clientName"`
	CompanyID      *string    `json:"companyId"`
	EngagementID   *string    `json:"engagementId"`
	WorkType       *string    `json:"workType"`
	PeriodKey      *string    `json:"periodKey"`
	FY             *string    `json:"fy"`
	Overlay        *string    `json:"overlay"`
	RiskClass      *string    `json:"riskClass"`
	Department     *string    `json:"department"`
	Tags           *[]string  `json:"tags"`
	EstimatedHours *float64   `json:"estimatedHours"`
	ActualHours    *float64   `json:"actualHours"`
	CompletionPct  *int       `json:"completionPct"`
	ParentID       *string    `json:"parentId"`
	DelegatedClose *bool      `json:"delegatedClose"`
	RequiresPartnerSignoff *bool `json:"requiresPartnerSignoff"`
}

// UpdateWork updates fields the actor is allowed to change.
func (s *Service) UpdateWork(ctx context.Context, actor Actor, id string, patch WorkPatch) (*WorkItem, error) {
	cur, err := s.store.GetWork(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("work item not found")
	}
	assignee := firstNonEmptyStr(cur.AssigneeID, cur.AssignedTo)
	if IsExecutor(actor.Hierarchy) {
		if assignee != actor.ID {
			return nil, apperrors.Forbidden("executors can only update work assigned to them")
		}
	}
	if IsTerminalStatus(cur.Status) {
		return nil, apperrors.Conflict("CLOSED/CANCELLED work is immutable except Manager/Partner reopen")
	}
	if err := s.require(actor, PermEdit); err != nil {
		return nil, err
	}

	oldStatus, oldPriority := cur.Status, cur.Priority
	setStr := func(field string, dst *string, src *string) {
		if src == nil {
			return
		}
		if *dst != *src {
			s.auditField(ctx, actor, id, "work_item", id, field, *dst, *src)
			*dst = *src
		}
	}
	setStr("title", &cur.Title, patch.Title)
	setStr("description", &cur.Description, patch.Description)
	setStr("department", &cur.Department, patch.Department)
	setStr("clientId", &cur.ClientID, patch.ClientID)
	setStr("clientName", &cur.ClientName, patch.ClientName)
	setStr("companyId", &cur.CompanyID, patch.CompanyID)
	setStr("engagementId", &cur.EngagementID, patch.EngagementID)
	setStr("workType", &cur.WorkType, patch.WorkType)
	setStr("periodKey", &cur.PeriodKey, patch.PeriodKey)
	setStr("fy", &cur.FY, patch.FY)
	if patch.Overlay != nil {
		cur.Overlay = NormalizeOverlay(*patch.Overlay)
	}
	if patch.RiskClass != nil {
		cur.RiskClass = NormalizeRiskClass(*patch.RiskClass)
	}
	if patch.DelegatedClose != nil {
		cur.DelegatedClose = *patch.DelegatedClose
	}
	if patch.RequiresPartnerSignoff != nil {
		cur.RequiresPartnerSignoff = *patch.RequiresPartnerSignoff
	}
	if patch.Priority != nil {
		cur.Priority = normalizePriority(*patch.Priority)
	}
	if patch.Status != nil {
		next := normalizeStatus(*patch.Status)
		if err := AssertFreeStatusPatch(next); err != nil {
			return nil, err
		}
		cur.Status = next
	}
	if patch.Tags != nil {
		cur.Tags = *patch.Tags
	}
	if patch.EstimatedHours != nil {
		cur.EstimatedHours = *patch.EstimatedHours
	}
	if patch.ActualHours != nil {
		cur.ActualHours = *patch.ActualHours
	}
	if patch.CompletionPct != nil {
		pct := *patch.CompletionPct
		if pct < 0 {
			pct = 0
		}
		if pct > 100 {
			pct = 100
		}
		cur.CompletionPct = pct
	}
	if patch.DueDate != nil {
		cur.DueDate = patch.DueDate
	}
	if patch.ParentID != nil {
		cur.ParentID = *patch.ParentID
	}
	cur.UpdatedBy = actor.ID

	if err := s.store.UpdateWork(ctx, cur); err != nil {
		return nil, apperrors.Internal("failed to update work", err)
	}
	s.activity(ctx, actor, id, ActionUpdated, "Work updated", nil)
	if oldStatus != cur.Status {
		s.activity(ctx, actor, id, ActionStatusChange, oldStatus+" → "+cur.Status, nil)
		s.auditField(ctx, actor, id, "work_item", id, "status", oldStatus, cur.Status)
	}
	if oldPriority != cur.Priority {
		s.activity(ctx, actor, id, ActionPriorityChange, oldPriority+" → "+cur.Priority, nil)
		s.auditField(ctx, actor, id, "work_item", id, "priority", oldPriority, cur.Priority)
	}
	return s.store.GetWork(ctx, id, false)
}

// Reassign changes assignee.
func (s *Service) Reassign(ctx context.Context, actor Actor, id, toID, toName, toRole string) (*WorkItem, error) {
	if err := s.require(actor, PermAssign); err != nil {
		return nil, err
	}
	if !CanAssignTo(actor.Hierarchy, toRole) {
		return nil, apperrors.Forbidden("cannot reassign to this role")
	}
	cur, err := s.store.GetWork(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("work item not found")
	}
	old := cur.AssignedTo
	cur.AssignedTo = toID
	cur.AssignedToName = toName
	cur.AssignedBy = actor.ID
	cur.AssignedByName = actor.Name
	cur.UpdatedBy = actor.ID
	if err := s.store.UpdateWork(ctx, cur); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, id, ActionReassigned, "Reassigned from "+old+" to "+toID, nil)
	s.auditField(ctx, actor, id, "work_item", id, "assignedTo", old, toID)
	s.notify(ctx, toID, id, "reassignment", "Work reassigned to you", cur.Title)
	return s.store.GetWork(ctx, id, false)
}

// Transfer is an explicit ownership transfer (same as reassign + transfer activity).
func (s *Service) Transfer(ctx context.Context, actor Actor, id, toID, toName, toRole string) (*WorkItem, error) {
	w, err := s.Reassign(ctx, actor, id, toID, toName, toRole)
	if err != nil {
		return nil, err
	}
	s.activity(ctx, actor, id, ActionTransferred, "Transferred to "+toName, nil)
	return w, nil
}

func (s *Service) GetWork(ctx context.Context, actor Actor, id string) (*WorkItem, error) {
	if err := s.require(actor, PermView); err != nil {
		return nil, err
	}
	w, err := s.store.GetWork(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("work item not found")
	}
	if !canViewWork(actor, w) {
		return nil, apperrors.Forbidden("cannot view this work item")
	}
	return w, nil
}

func (s *Service) ListWork(ctx context.Context, actor Actor, f ListFilter) (Page[WorkItem], error) {
	if err := s.require(actor, PermView); err != nil {
		return Page[WorkItem]{}, err
	}
	applyListScope(actor, &f)
	return s.store.ListWork(ctx, f)
}

func (s *Service) SoftDelete(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermDelete); err != nil {
		return err
	}
	if IsExecutor(actor.Hierarchy) || IsSupportRole(actor.Hierarchy) {
		return apperrors.Forbidden("executors/support cannot delete work")
	}
	if err := s.store.SoftDeleteWork(ctx, id, actor.ID); err != nil {
		return apperrors.NotFound("work item not found")
	}
	s.activity(ctx, actor, id, ActionDelete, "Soft deleted", nil)
	return nil
}

func (s *Service) Restore(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermDelete); err != nil {
		return err
	}
	if err := s.store.RestoreWork(ctx, id); err != nil {
		return apperrors.NotFound("work item not found")
	}
	s.activity(ctx, actor, id, ActionRestore, "Restored", nil)
	return nil
}

func (s *Service) PermanentDeleteForbidden() error {
	return apperrors.Forbidden("permanent delete is disabled — soft delete only")
}

// --- child resources ---

func (s *Service) ensureWorkAccess(ctx context.Context, actor Actor, workID string, needEdit bool) (*WorkItem, error) {
	w, err := s.GetWork(ctx, actor, workID)
	if err != nil {
		return nil, err
	}
	if needEdit {
		assignee := firstNonEmptyStr(w.AssigneeID, w.AssignedTo)
		if IsExecutor(actor.Hierarchy) && assignee != actor.ID {
			return nil, apperrors.Forbidden("cannot modify this work item")
		}
		if err := s.require(actor, PermEdit); err != nil {
			return nil, err
		}
	}
	return w, nil
}

func (s *Service) AddFollowUp(ctx context.Context, actor Actor, f *FollowUp) (*FollowUp, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, f.WorkItemID, true); err != nil {
		return nil, err
	}
	f.CreatedBy = actor.ID
	if err := s.store.AddFollowUp(ctx, f); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, f.WorkItemID, ActionFollowUp, "Follow-up added", nil)
	return f, nil
}

func (s *Service) ListFollowUps(ctx context.Context, actor Actor, workID string) ([]FollowUp, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListFollowUps(ctx, workID)
}

func (s *Service) AddCall(ctx context.Context, actor Actor, c *CallLog) (*CallLog, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, c.WorkItemID, true); err != nil {
		return nil, err
	}
	dir := strings.ToLower(c.Direction)
	if dir != "incoming" && dir != "outgoing" {
		return nil, apperrors.Validation("direction must be incoming or outgoing")
	}
	c.Direction = dir
	c.CreatedBy = actor.ID
	if err := s.store.AddCall(ctx, c); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, c.WorkItemID, ActionCall, "Call logged", nil)
	return c, nil
}

func (s *Service) ListCalls(ctx context.Context, actor Actor, workID string) ([]CallLog, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListCalls(ctx, workID)
}

func (s *Service) AddEmail(ctx context.Context, actor Actor, e *EmailLog) (*EmailLog, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, e.WorkItemID, true); err != nil {
		return nil, err
	}
	e.CreatedBy = actor.ID
	if e.Attachments == nil {
		e.Attachments = []string{}
	}
	if err := s.store.AddEmail(ctx, e); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, e.WorkItemID, ActionEmail, "Email logged", nil)
	return e, nil
}

func (s *Service) ListEmails(ctx context.Context, actor Actor, workID string) ([]EmailLog, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListEmails(ctx, workID)
}

func (s *Service) AddMeeting(ctx context.Context, actor Actor, m *MeetingLog) (*MeetingLog, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, m.WorkItemID, true); err != nil {
		return nil, err
	}
	m.CreatedBy = actor.ID
	if m.Participants == nil {
		m.Participants = []string{}
	}
	if err := s.store.AddMeeting(ctx, m); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, m.WorkItemID, ActionMeeting, "Meeting logged", nil)
	return m, nil
}

func (s *Service) ListMeetings(ctx context.Context, actor Actor, workID string) ([]MeetingLog, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListMeetings(ctx, workID)
}

func (s *Service) AddNote(ctx context.Context, actor Actor, n *Note) (*Note, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, n.WorkItemID, true); err != nil {
		return nil, err
	}
	n.CreatedBy = actor.ID
	if n.Format == "" {
		n.Format = "markdown"
	}
	if err := s.store.AddNote(ctx, n); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, n.WorkItemID, ActionNote, "Note added", nil)
	return n, nil
}

func (s *Service) ListNotes(ctx context.Context, actor Actor, workID string) ([]Note, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListNotes(ctx, workID)
}

func (s *Service) AddComment(ctx context.Context, actor Actor, c *Comment) (*Comment, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, c.WorkItemID, false); err != nil {
		return nil, err
	}
	if err := s.require(actor, PermComment); err != nil {
		return nil, err
	}
	if strings.TrimSpace(c.Body) == "" {
		return nil, apperrors.Validation("comment body is required")
	}
	c.CreatedBy = actor.ID
	if err := s.store.AddComment(ctx, c); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, c.WorkItemID, ActionCommented, "Comment added", nil)
	for _, m := range c.Mentions {
		s.notify(ctx, m, c.WorkItemID, "mention", "You were mentioned", c.Body)
	}
	s.notify(ctx, "", c.WorkItemID, "comment", "New comment", c.Body)
	return c, nil
}

func (s *Service) ListComments(ctx context.Context, actor Actor, workID string) ([]Comment, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListComments(ctx, workID)
}

func DetectAttachmentKind(fileName, contentType string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch {
	case ext == ".pdf" || strings.Contains(contentType, "pdf"):
		return "pdf"
	case ext == ".xls" || ext == ".xlsx" || strings.Contains(contentType, "spreadsheet") || strings.Contains(contentType, "excel"):
		return "excel"
	case ext == ".doc" || ext == ".docx" || strings.Contains(contentType, "word"):
		return "word"
	case ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".gif" || ext == ".webp" || strings.HasPrefix(contentType, "image/"):
		return "image"
	case ext == ".zip" || ext == ".rar" || strings.Contains(contentType, "zip"):
		return "zip"
	default:
		return "other"
	}
}

func (s *Service) AddAttachment(ctx context.Context, actor Actor, a *Attachment) (*Attachment, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, a.WorkItemID, true); err != nil {
		return nil, err
	}
	if err := s.require(actor, PermUpload); err != nil {
		return nil, err
	}
	a.UploadedBy = actor.ID
	a.Kind = DetectAttachmentKind(a.FileName, a.ContentType)
	allowed := map[string]bool{"pdf": true, "excel": true, "word": true, "image": true, "zip": true}
	if !allowed[a.Kind] {
		return nil, apperrors.Validation("unsupported attachment type")
	}
	if err := s.store.AddAttachment(ctx, a); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, a.WorkItemID, ActionUpload, "Uploaded "+a.FileName, nil)
	return a, nil
}

func (s *Service) ListAttachments(ctx context.Context, actor Actor, workID string) ([]Attachment, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListAttachments(ctx, workID)
}

func (s *Service) SoftDeleteAttachment(ctx context.Context, actor Actor, id string) error {
	a, err := s.store.GetAttachment(ctx, id, false)
	if err != nil {
		return apperrors.NotFound("attachment not found")
	}
	if _, err := s.ensureWorkAccess(ctx, actor, a.WorkItemID, true); err != nil {
		return err
	}
	if err := s.store.SoftDeleteAttachment(ctx, id, actor.ID); err != nil {
		return err
	}
	s.activity(ctx, actor, a.WorkItemID, ActionDelete, "Attachment soft-deleted", nil)
	return nil
}

func (s *Service) RestoreAttachment(ctx context.Context, actor Actor, id string) error {
	a, err := s.store.GetAttachment(ctx, id, true)
	if err != nil {
		return apperrors.NotFound("attachment not found")
	}
	if err := s.require(actor, PermUpload); err != nil {
		return err
	}
	if _, err := s.ensureWorkAccess(ctx, actor, a.WorkItemID, true); err != nil {
		return err
	}
	if err := s.store.RestoreAttachment(ctx, id); err != nil {
		return err
	}
	s.activity(ctx, actor, a.WorkItemID, ActionRestore, "Attachment restored", nil)
	return nil
}

func (s *Service) MarkDownload(ctx context.Context, actor Actor, id string) (*Attachment, error) {
	a, err := s.store.GetAttachment(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("attachment not found")
	}
	if _, err := s.ensureWorkAccess(ctx, actor, a.WorkItemID, false); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, a.WorkItemID, ActionDownload, "Downloaded "+a.FileName, nil)
	return a, nil
}

func (s *Service) ListActivity(ctx context.Context, actor Actor, workID string) ([]ActivityEvent, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListActivity(ctx, workID)
}

func (s *Service) ListAudit(ctx context.Context, actor Actor, workID string) ([]AuditEntry, error) {
	if err := s.require(actor, PermAuditView); err != nil {
		return nil, err
	}
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListAudit(ctx, workID)
}

func (s *Service) Timeline(ctx context.Context, actor Actor, limit int) ([]ActivityEvent, error) {
	if err := s.require(actor, PermView); err != nil {
		return nil, err
	}
	return s.store.ListGlobalActivity(ctx, limit)
}

func (s *Service) Dashboard(ctx context.Context, actor Actor) (DashboardStats, error) {
	today := time.Now().UTC().Format("2006-01-02")
	if IsLeadership(actor.Hierarchy) || IsProfessional(actor.Hierarchy) {
		if err := s.require(actor, PermDashboardManage); err != nil {
			return DashboardStats{}, err
		}
	} else {
		if err := s.require(actor, PermDashboardMine); err != nil {
			return DashboardStats{}, err
		}
	}
	return s.store.Dashboard(ctx, actor, today)
}

func (s *Service) Search(ctx context.Context, actor Actor, q string) ([]WorkItem, error) {
	page, err := s.ListWork(ctx, actor, ListFilter{Page: 1, PageSize: 50, Query: q})
	if err != nil {
		return nil, err
	}
	return page.Items, nil
}

// AssertCreateUser enforces hierarchy create rules.
func (s *Service) AssertCreateUser(actor Actor, targetRole string) error {
	if err := s.require(actor, PermUsersCreate); err != nil {
		return err
	}
	if err := AssertCreatableRole(actor.Hierarchy, targetRole); err != nil {
		return apperrors.Forbidden(err.Error())
	}
	return nil
}

// DueNotifications scans for due today / overdue (callable by cron or request).
func (s *Service) EmitDueNotifications(ctx context.Context) error {
	page, err := s.store.ListWork(ctx, ListFilter{Page: 1, PageSize: 500})
	if err != nil {
		return err
	}
	today := time.Now().UTC().Format("2006-01-02")
	now := time.Now().UTC()
	for _, w := range page.Items {
		if w.DueDate == nil || IsTerminalStatus(w.Status) || IsClosedLike(w.Status) {
			continue
		}
		d := w.DueDate.Format("2006-01-02")
		if d == today {
			s.notify(ctx, w.AssignedTo, w.ID, "due_today", "Due today", w.Title)
		} else if w.DueDate.Before(now) {
			s.notify(ctx, w.AssignedTo, w.ID, "overdue", "Overdue", w.Title)
		}
	}
	return nil
}
