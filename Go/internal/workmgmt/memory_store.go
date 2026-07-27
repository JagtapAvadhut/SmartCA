package workmgmt

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemoryStore is a thread-safe in-memory Store for local tests (no Docker).
type MemoryStore struct {
	mu            sync.RWMutex
	work          map[string]*WorkItem
	followups     map[string]*FollowUp
	calls         map[string]*CallLog
	emails        map[string]*EmailLog
	meetings      map[string]*MeetingLog
	notes         map[string]*Note
	comments      map[string]*Comment
	attachments   map[string]*Attachment
	activity      []*ActivityEvent
	audit         []*AuditEntry
	notifications []*Notification
	engagements   map[string]*Engagement
	intakes       map[string]*Intake
	checklist     map[string]*ChecklistItem
	transitions   []*WorkTransitionHistory
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		work:        map[string]*WorkItem{},
		followups:   map[string]*FollowUp{},
		calls:       map[string]*CallLog{},
		emails:      map[string]*EmailLog{},
		meetings:    map[string]*MeetingLog{},
		notes:       map[string]*Note{},
		comments:    map[string]*Comment{},
		attachments: map[string]*Attachment{},
		engagements: map[string]*Engagement{},
		intakes:     map[string]*Intake{},
		checklist:   map[string]*ChecklistItem{},
	}
}

func newID() string { return uuid.Must(uuid.NewV7()).String() }

func (s *MemoryStore) CreateWork(_ context.Context, w *WorkItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if w.ID == "" {
		w.ID = newID()
	}
	now := time.Now().UTC()
	w.CreatedAt = now
	w.UpdatedAt = now
	if w.CreatedDate.IsZero() {
		w.CreatedDate = now
	}
	if w.Tags == nil {
		w.Tags = []string{}
	}
	cp := *w
	s.work[w.ID] = &cp
	return nil
}

func (s *MemoryStore) UpdateWork(_ context.Context, w *WorkItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, ok := s.work[w.ID]
	if !ok || cur.DeletedAt != nil {
		return fmt.Errorf("work item not found")
	}
	w.CreatedAt = cur.CreatedAt
	w.CreatedDate = cur.CreatedDate
	w.CreatedBy = cur.CreatedBy
	w.UpdatedAt = time.Now().UTC()
	cp := *w
	s.work[w.ID] = &cp
	return nil
}

func (s *MemoryStore) GetWork(_ context.Context, id string, includeDeleted bool) (*WorkItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	w, ok := s.work[id]
	if !ok {
		return nil, fmt.Errorf("work item not found")
	}
	if w.DeletedAt != nil && !includeDeleted {
		return nil, fmt.Errorf("work item not found")
	}
	cp := *w
	cp.ChildCount = s.countChildrenLocked(id)
	return &cp, nil
}

func (s *MemoryStore) countChildrenLocked(parentID string) int {
	n := 0
	for _, w := range s.work {
		if w.ParentID == parentID && w.DeletedAt == nil {
			n++
		}
	}
	return n
}

func (s *MemoryStore) CountChildren(_ context.Context, parentID string) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.countChildrenLocked(parentID), nil
}

func (s *MemoryStore) ListWork(_ context.Context, f ListFilter) (Page[WorkItem], error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if f.ForceEmpty {
		return Page[WorkItem]{Items: []WorkItem{}, Total: 0, Page: 1, PageSize: f.PageSize, TotalPages: 0}, nil
	}
	items := make([]WorkItem, 0)
	q := strings.ToLower(strings.TrimSpace(f.Query))
	for _, w := range s.work {
		if w.DeletedAt != nil && !f.IncludeDeleted {
			continue
		}
		if f.Status != "" && !strings.EqualFold(w.Status, f.Status) && NormalizePracticeStatus(w.Status) != NormalizePracticeStatus(f.Status) {
			continue
		}
		if f.Priority != "" && !strings.EqualFold(w.Priority, f.Priority) {
			continue
		}
		if f.AssigneeID != "" {
			assignee := firstNonEmptyStr(w.AssigneeID, w.AssignedTo)
			if assignee != f.AssigneeID {
				continue
			}
		}
		if f.FirmKey != "" {
			if !WorkBelongsToFirm(f.FirmKey, w.CreatedBy, w.AssignedBy, w.AssignedTo, w.OwnerCAID, w.TlID, w.AssigneeID, w.ID) {
				continue
			}
		}
		if f.OwnerCAID != "" || f.TlID != "" || len(f.ScopeDownlineIDs) > 0 {
			ok := false
			if f.OwnerCAID != "" && (w.OwnerCAID == f.OwnerCAID || firstNonEmptyStr(w.AssigneeID, w.AssignedTo) == f.OwnerCAID || w.CreatedBy == f.OwnerCAID || w.AssignedBy == f.OwnerCAID) {
				ok = true
			}
			if f.TlID != "" && (w.TlID == f.TlID || firstNonEmptyStr(w.AssigneeID, w.AssignedTo) == f.TlID || w.CreatedBy == f.TlID) {
				ok = true
			}
			assignee := firstNonEmptyStr(w.AssigneeID, w.AssignedTo)
			for _, id := range f.ScopeDownlineIDs {
				if assignee == id || w.OwnerCAID == id || w.TlID == id {
					ok = true
					break
				}
			}
			if !ok && f.OwnerCAID == "" && f.TlID == "" {
				ok = true
			}
			if !ok {
				continue
			}
		}
		if f.InvolvedUserID != "" {
			uid := f.InvolvedUserID
			assignee := firstNonEmptyStr(w.AssigneeID, w.AssignedTo)
			if assignee != uid && w.AssignedBy != uid && w.CreatedBy != uid && w.OwnerCAID != uid && w.TlID != uid {
				continue
			}
		}
		if f.ClientID != "" && w.ClientID != f.ClientID {
			continue
		}
		if f.CompanyID != "" && w.CompanyID != f.CompanyID {
			continue
		}
		if f.EngagementID != "" && w.EngagementID != f.EngagementID {
			continue
		}
		if f.WorkType != "" && !strings.EqualFold(w.WorkType, f.WorkType) {
			continue
		}
		if f.PeriodKey != "" && w.PeriodKey != f.PeriodKey {
			continue
		}
		if f.Overlay != "" && !strings.EqualFold(w.Overlay, f.Overlay) {
			continue
		}
		if f.Department != "" && !strings.EqualFold(w.Department, f.Department) {
			continue
		}
		if f.From != nil && w.DueDate != nil && w.DueDate.Before(*f.From) {
			continue
		}
		if f.To != nil && w.DueDate != nil && w.DueDate.After(*f.To) {
			continue
		}
		if q != "" {
			hay := strings.ToLower(w.Title + " " + w.Description + " " + w.ClientName + " " + w.Department + " " + strings.Join(w.Tags, " "))
			if !strings.Contains(hay, q) {
				continue
			}
		}
		cp := *w
		cp.ChildCount = s.countChildrenLocked(w.ID)
		items = append(items, cp)
	}
	sort.Slice(items, func(i, j int) bool {
		switch f.Sort {
		case "dueDate", "dueDate:asc":
			di, dj := items[i].DueDate, items[j].DueDate
			if di == nil {
				return false
			}
			if dj == nil {
				return true
			}
			return di.Before(*dj)
		case "priority", "priority:desc":
			return priorityRank(items[i].Priority) > priorityRank(items[j].Priority)
		case "title":
			return items[i].Title < items[j].Title
		default:
			return items[i].UpdatedAt.After(items[j].UpdatedAt)
		}
	})
	page, size := f.Page, f.PageSize
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 20
	}
	total := len(items)
	start := (page - 1) * size
	if start > total {
		start = total
	}
	end := start + size
	if end > total {
		end = total
	}
	tp := total / size
	if total%size != 0 {
		tp++
	}
	return Page[WorkItem]{Items: items[start:end], Total: total, Page: page, PageSize: size, TotalPages: tp}, nil
}

func priorityRank(p string) int {
	switch strings.ToLower(p) {
	case "urgent":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	default:
		return 1
	}
}

func (s *MemoryStore) SoftDeleteWork(_ context.Context, id, by string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, ok := s.work[id]
	if !ok || w.DeletedAt != nil {
		return fmt.Errorf("work item not found")
	}
	now := time.Now().UTC()
	w.DeletedAt = &now
	w.DeletedBy = by
	w.UpdatedAt = now
	return nil
}

func (s *MemoryStore) RestoreWork(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, ok := s.work[id]
	if !ok || w.DeletedAt == nil {
		return fmt.Errorf("work item not found")
	}
	w.DeletedAt = nil
	w.DeletedBy = ""
	w.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) AddFollowUp(_ context.Context, f *FollowUp) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if f.ID == "" {
		f.ID = newID()
	}
	now := time.Now().UTC()
	f.CreatedAt, f.UpdatedAt = now, now
	cp := *f
	s.followups[f.ID] = &cp
	return nil
}

func (s *MemoryStore) ListFollowUps(_ context.Context, workID string) ([]FollowUp, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []FollowUp{}
	for _, f := range s.followups {
		if f.WorkItemID == workID && f.DeletedAt == nil {
			out = append(out, *f)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (s *MemoryStore) SoftDeleteFollowUp(_ context.Context, id, by string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, ok := s.followups[id]
	if !ok || f.DeletedAt != nil {
		return fmt.Errorf("follow-up not found")
	}
	now := time.Now().UTC()
	f.DeletedAt = &now
	_ = by
	return nil
}

func (s *MemoryStore) RestoreFollowUp(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, ok := s.followups[id]
	if !ok || f.DeletedAt == nil {
		return fmt.Errorf("follow-up not found")
	}
	f.DeletedAt = nil
	f.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) UpdateFollowUp(_ context.Context, f *FollowUp) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, ok := s.followups[f.ID]
	if !ok || cur.DeletedAt != nil {
		return fmt.Errorf("follow-up not found")
	}
	f.UpdatedAt = time.Now().UTC()
	f.CreatedAt = cur.CreatedAt
	f.CreatedBy = cur.CreatedBy
	f.WorkItemID = cur.WorkItemID
	cp := *f
	s.followups[f.ID] = &cp
	return nil
}

func (s *MemoryStore) AddCall(_ context.Context, c *CallLog) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c.ID == "" {
		c.ID = newID()
	}
	now := time.Now().UTC()
	c.CreatedAt, c.UpdatedAt = now, now
	cp := *c
	s.calls[c.ID] = &cp
	return nil
}

func (s *MemoryStore) ListCalls(_ context.Context, workID string) ([]CallLog, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []CallLog{}
	for _, c := range s.calls {
		if c.WorkItemID == workID && c.DeletedAt == nil {
			out = append(out, *c)
		}
	}
	return out, nil
}

func (s *MemoryStore) SoftDeleteCall(_ context.Context, id, by string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.calls[id]
	if !ok || c.DeletedAt != nil {
		return fmt.Errorf("call not found")
	}
	now := time.Now().UTC()
	c.DeletedAt = &now
	_ = by
	return nil
}

func (s *MemoryStore) RestoreCall(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.calls[id]
	if !ok || c.DeletedAt == nil {
		return fmt.Errorf("call not found")
	}
	c.DeletedAt = nil
	c.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) AddEmail(_ context.Context, e *EmailLog) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e.ID == "" {
		e.ID = newID()
	}
	now := time.Now().UTC()
	e.CreatedAt, e.UpdatedAt = now, now
	if e.Attachments == nil {
		e.Attachments = []string{}
	}
	cp := *e
	s.emails[e.ID] = &cp
	return nil
}

func (s *MemoryStore) ListEmails(_ context.Context, workID string) ([]EmailLog, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []EmailLog{}
	for _, e := range s.emails {
		if e.WorkItemID == workID && e.DeletedAt == nil {
			out = append(out, *e)
		}
	}
	return out, nil
}

func (s *MemoryStore) SoftDeleteEmail(_ context.Context, id, by string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.emails[id]
	if !ok || e.DeletedAt != nil {
		return fmt.Errorf("email not found")
	}
	now := time.Now().UTC()
	e.DeletedAt = &now
	_ = by
	return nil
}

func (s *MemoryStore) RestoreEmail(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.emails[id]
	if !ok || e.DeletedAt == nil {
		return fmt.Errorf("email not found")
	}
	e.DeletedAt = nil
	e.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) AddMeeting(_ context.Context, m *MeetingLog) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if m.ID == "" {
		m.ID = newID()
	}
	now := time.Now().UTC()
	m.CreatedAt, m.UpdatedAt = now, now
	if m.Participants == nil {
		m.Participants = []string{}
	}
	cp := *m
	s.meetings[m.ID] = &cp
	return nil
}

func (s *MemoryStore) ListMeetings(_ context.Context, workID string) ([]MeetingLog, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []MeetingLog{}
	for _, m := range s.meetings {
		if m.WorkItemID == workID && m.DeletedAt == nil {
			out = append(out, *m)
		}
	}
	return out, nil
}

func (s *MemoryStore) SoftDeleteMeeting(_ context.Context, id, by string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, ok := s.meetings[id]
	if !ok || m.DeletedAt != nil {
		return fmt.Errorf("meeting not found")
	}
	now := time.Now().UTC()
	m.DeletedAt = &now
	_ = by
	return nil
}

func (s *MemoryStore) RestoreMeeting(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, ok := s.meetings[id]
	if !ok || m.DeletedAt == nil {
		return fmt.Errorf("meeting not found")
	}
	m.DeletedAt = nil
	m.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) AddNote(_ context.Context, n *Note) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if n.ID == "" {
		n.ID = newID()
	}
	now := time.Now().UTC()
	n.CreatedAt, n.UpdatedAt = now, now
	if n.AttachmentIDs == nil {
		n.AttachmentIDs = []string{}
	}
	cp := *n
	s.notes[n.ID] = &cp
	return nil
}

func (s *MemoryStore) UpdateNote(_ context.Context, n *Note) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, ok := s.notes[n.ID]
	if !ok || cur.DeletedAt != nil {
		return fmt.Errorf("note not found")
	}
	now := time.Now().UTC()
	n.CreatedAt = cur.CreatedAt
	n.CreatedBy = cur.CreatedBy
	n.EditedAt = &now
	n.UpdatedAt = now
	cp := *n
	s.notes[n.ID] = &cp
	return nil
}

func (s *MemoryStore) ListNotes(_ context.Context, workID string) ([]Note, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []Note{}
	for _, n := range s.notes {
		if n.WorkItemID == workID && n.DeletedAt == nil {
			out = append(out, *n)
		}
	}
	return out, nil
}

func (s *MemoryStore) SoftDeleteNote(_ context.Context, id, by string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.notes[id]
	if !ok || n.DeletedAt != nil {
		return fmt.Errorf("note not found")
	}
	now := time.Now().UTC()
	n.DeletedAt = &now
	_ = by
	return nil
}

func (s *MemoryStore) RestoreNote(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.notes[id]
	if !ok || n.DeletedAt == nil {
		return fmt.Errorf("note not found")
	}
	n.DeletedAt = nil
	n.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) AddComment(_ context.Context, c *Comment) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c.ID == "" {
		c.ID = newID()
	}
	now := time.Now().UTC()
	c.CreatedAt, c.UpdatedAt = now, now
	if c.Mentions == nil {
		c.Mentions = []string{}
	}
	cp := *c
	s.comments[c.ID] = &cp
	return nil
}

func (s *MemoryStore) ListComments(_ context.Context, workID string) ([]Comment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []Comment{}
	for _, c := range s.comments {
		if c.WorkItemID == workID && c.DeletedAt == nil {
			out = append(out, *c)
		}
	}
	return out, nil
}

func (s *MemoryStore) SoftDeleteComment(_ context.Context, id, by string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.comments[id]
	if !ok || c.DeletedAt != nil {
		return fmt.Errorf("comment not found")
	}
	now := time.Now().UTC()
	c.DeletedAt = &now
	_ = by
	return nil
}

func (s *MemoryStore) RestoreComment(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.comments[id]
	if !ok || c.DeletedAt == nil {
		return fmt.Errorf("comment not found")
	}
	c.DeletedAt = nil
	c.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) AddAttachment(_ context.Context, a *Attachment) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if a.ID == "" {
		a.ID = newID()
	}
	now := time.Now().UTC()
	a.CreatedAt, a.UpdatedAt = now, now
	cp := *a
	s.attachments[a.ID] = &cp
	return nil
}

func (s *MemoryStore) ListAttachments(_ context.Context, workID string) ([]Attachment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []Attachment{}
	for _, a := range s.attachments {
		if a.WorkItemID == workID && a.DeletedAt == nil {
			out = append(out, *a)
		}
	}
	return out, nil
}

func (s *MemoryStore) GetAttachment(_ context.Context, id string, includeDeleted bool) (*Attachment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	a, ok := s.attachments[id]
	if !ok {
		return nil, fmt.Errorf("attachment not found")
	}
	if a.DeletedAt != nil && !includeDeleted {
		return nil, fmt.Errorf("attachment not found")
	}
	cp := *a
	return &cp, nil
}

func (s *MemoryStore) SoftDeleteAttachment(_ context.Context, id, by string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	a, ok := s.attachments[id]
	if !ok || a.DeletedAt != nil {
		return fmt.Errorf("attachment not found")
	}
	now := time.Now().UTC()
	a.DeletedAt = &now
	a.DeletedBy = by
	return nil
}

func (s *MemoryStore) RestoreAttachment(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	a, ok := s.attachments[id]
	if !ok || a.DeletedAt == nil {
		return fmt.Errorf("attachment not found")
	}
	a.DeletedAt = nil
	a.DeletedBy = ""
	return nil
}

func (s *MemoryStore) AddActivity(_ context.Context, a *ActivityEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if a.ID == "" {
		a.ID = newID()
	}
	a.CreatedAt = time.Now().UTC()
	cp := *a
	s.activity = append(s.activity, &cp)
	return nil
}

func (s *MemoryStore) ListActivity(_ context.Context, workID string) ([]ActivityEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []ActivityEvent{}
	for _, a := range s.activity {
		if a.WorkItemID == workID {
			out = append(out, *a)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (s *MemoryStore) ListGlobalActivity(_ context.Context, limit int) ([]ActivityEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ActivityEvent, 0, len(s.activity))
	for _, a := range s.activity {
		out = append(out, *a)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (s *MemoryStore) AddAudit(_ context.Context, a *AuditEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if a.ID == "" {
		a.ID = newID()
	}
	a.CreatedAt = time.Now().UTC()
	cp := *a
	s.audit = append(s.audit, &cp)
	return nil
}

func (s *MemoryStore) ListAudit(_ context.Context, workID string) ([]AuditEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []AuditEntry{}
	for _, a := range s.audit {
		if a.WorkItemID == workID {
			out = append(out, *a)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (s *MemoryStore) AddNotification(_ context.Context, n *Notification) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if n.ID == "" {
		n.ID = newID()
	}
	n.CreatedAt = time.Now().UTC()
	cp := *n
	s.notifications = append(s.notifications, &cp)
	return nil
}

func (s *MemoryStore) ListNotifications(_ context.Context, userID string) ([]Notification, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []Notification{}
	for _, n := range s.notifications {
		if n.UserID == userID && n.DeletedAt == nil {
			out = append(out, *n)
		}
	}
	return out, nil
}

func (s *MemoryStore) Dashboard(_ context.Context, actor Actor, today string) (DashboardStats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	stats := DashboardStats{
		EmployeePerformance:   map[string]int{},
		CAPerformance:         map[string]int{},
		TeamLeaderPerformance: map[string]int{},
		DepartmentSummary:     map[string]int{},
	}
	now := time.Now().UTC()
	for _, w := range s.work {
		if w.DeletedAt != nil {
			continue
		}
		if !canViewWork(actor, w) {
			continue
		}
		st := NormalizePracticeStatus(w.Status)
		// Practice Core: pending = not CLOSED/CANCELLED; completed = CLOSED only.
		pending := !IsTerminalStatus(w.Status)
		if pending {
			stats.Pending++
			stats.PendingTasks++
		}
		if st == StatusClosed {
			stats.Completed++
			stats.CompletedTasks++
		}
		switch st {
		case StatusReadyForTLVerify:
			stats.ReadyForTLVerify++
		case StatusReadyForCAVerify:
			stats.ReadyForCAVerify++
		case StatusReadyForManagerClose:
			stats.ReadyForManagerClose++
		}
		if w.DueDate != nil && w.DueDate.Before(now) && pending {
			stats.Overdue++
		}
		if w.DueDate != nil && w.DueDate.Format("2006-01-02") == today {
			stats.TodaysWork++
		}
		if firstNonEmptyStr(w.AssigneeID, w.AssignedTo) == actor.ID {
			stats.MyWork++
		}
		if w.Department != "" {
			stats.DepartmentSummary[w.Department]++
		}
		stats.EmployeePerformance[w.AssignedTo]++
	}
	stats.AwaitingClose = stats.ReadyForManagerClose
	for _, f := range s.followups {
		if f.DeletedAt == nil && f.FollowUpDate == today {
			stats.TodaysFollowUps++
		}
	}
	for _, c := range s.calls {
		if c.DeletedAt == nil && c.NextCallDate != "" && c.NextCallDate >= today {
			stats.UpcomingCalls++
		}
	}
	return stats, nil
}

func (s *MemoryStore) Search(ctx context.Context, actor Actor, q string, limit int) ([]WorkItem, error) {
	page, err := s.ListWork(ctx, ListFilter{Page: 1, PageSize: limit, Query: q})
	if err != nil {
		return nil, err
	}
	out := make([]WorkItem, 0, len(page.Items))
	for _, w := range page.Items {
		if !canViewWork(actor, &w) {
			continue
		}
		out = append(out, w)
	}
	return out, nil
}

func (s *MemoryStore) CreateEngagement(_ context.Context, e *Engagement) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e.ID == "" {
		e.ID = newID()
	}
	now := time.Now().UTC()
	e.CreatedAt, e.UpdatedAt = now, now
	if e.Services == nil {
		e.Services = []string{}
	}
	cp := *e
	s.engagements[e.ID] = &cp
	return nil
}

func (s *MemoryStore) UpdateEngagement(_ context.Context, e *Engagement) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, ok := s.engagements[e.ID]
	if !ok || cur.DeletedAt != nil {
		return fmt.Errorf("engagement not found")
	}
	e.CreatedAt = cur.CreatedAt
	e.CreatedBy = cur.CreatedBy
	e.UpdatedAt = time.Now().UTC()
	cp := *e
	s.engagements[e.ID] = &cp
	return nil
}

func (s *MemoryStore) GetEngagement(_ context.Context, id string, includeDeleted bool) (*Engagement, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.engagements[id]
	if !ok {
		return nil, fmt.Errorf("engagement not found")
	}
	if e.DeletedAt != nil && !includeDeleted {
		return nil, fmt.Errorf("engagement not found")
	}
	cp := *e
	return &cp, nil
}

func (s *MemoryStore) ListEngagements(_ context.Context, clientID, ownerCAID string) ([]Engagement, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []Engagement{}
	for _, e := range s.engagements {
		if e.DeletedAt != nil {
			continue
		}
		if clientID != "" && e.ClientID != clientID {
			continue
		}
		if ownerCAID != "" && e.OwnerCAID != ownerCAID {
			continue
		}
		out = append(out, *e)
	}
	return out, nil
}

func (s *MemoryStore) CreateIntake(_ context.Context, in *Intake) error {
	s.mu.Lock()
	defer s.mu.Unlock()
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
	cp := *in
	s.intakes[in.ID] = &cp
	return nil
}

func (s *MemoryStore) UpdateIntake(_ context.Context, in *Intake) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, ok := s.intakes[in.ID]
	if !ok || cur.DeletedAt != nil {
		return fmt.Errorf("intake not found")
	}
	in.CreatedAt = cur.CreatedAt
	in.CreatedBy = cur.CreatedBy
	in.UpdatedAt = time.Now().UTC()
	cp := *in
	s.intakes[in.ID] = &cp
	return nil
}

func (s *MemoryStore) GetIntake(_ context.Context, id string, includeDeleted bool) (*Intake, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	in, ok := s.intakes[id]
	if !ok {
		return nil, fmt.Errorf("intake not found")
	}
	if in.DeletedAt != nil && !includeDeleted {
		return nil, fmt.Errorf("intake not found")
	}
	cp := *in
	return &cp, nil
}

func (s *MemoryStore) ListIntakes(_ context.Context, status, createdBy string) ([]Intake, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []Intake{}
	for _, in := range s.intakes {
		if in.DeletedAt != nil {
			continue
		}
		if status != "" && !strings.EqualFold(in.Status, status) {
			continue
		}
		if createdBy != "" && in.CreatedBy != createdBy {
			continue
		}
		out = append(out, *in)
	}
	return out, nil
}

func (s *MemoryStore) AddChecklistItem(_ context.Context, c *ChecklistItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c.ID == "" {
		c.ID = newID()
	}
	now := time.Now().UTC()
	c.CreatedAt, c.UpdatedAt = now, now
	cp := *c
	s.checklist[c.ID] = &cp
	return nil
}

func (s *MemoryStore) UpdateChecklistItem(_ context.Context, c *ChecklistItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, ok := s.checklist[c.ID]
	if !ok || cur.DeletedAt != nil {
		return fmt.Errorf("checklist item not found")
	}
	c.CreatedAt = cur.CreatedAt
	c.CreatedBy = cur.CreatedBy
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	s.checklist[c.ID] = &cp
	return nil
}

func (s *MemoryStore) GetChecklistItem(_ context.Context, id string) (*ChecklistItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.checklist[id]
	if !ok || c.DeletedAt != nil {
		return nil, fmt.Errorf("checklist item not found")
	}
	cp := *c
	return &cp, nil
}

func (s *MemoryStore) ListChecklist(_ context.Context, workID string) ([]ChecklistItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []ChecklistItem{}
	for _, c := range s.checklist {
		if c.DeletedAt == nil && c.WorkItemID == workID {
			out = append(out, *c)
		}
	}
	return out, nil
}

func (s *MemoryStore) AddTransitionHistory(_ context.Context, h *WorkTransitionHistory) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if h.ID == "" {
		h.ID = newID()
	}
	h.CreatedAt = time.Now().UTC()
	cp := *h
	s.transitions = append(s.transitions, &cp)
	return nil
}

func (s *MemoryStore) ListTransitionHistory(_ context.Context, workID string) ([]WorkTransitionHistory, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []WorkTransitionHistory{}
	for _, h := range s.transitions {
		if h.WorkItemID == workID {
			out = append(out, *h)
		}
	}
	return out, nil
}

func (s *MemoryStore) ApplyGateWrite(_ context.Context, g GateWrite) error {
	if g.Work == nil || g.ExpectedStatus == "" {
		return fmt.Errorf("gate write requires work and expected status")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	stampGateWrite(&g)
	cur, ok := s.work[g.Work.ID]
	if !ok || cur.DeletedAt != nil {
		return fmt.Errorf("work item not found")
	}
	if NormalizePracticeStatus(cur.Status) != NormalizePracticeStatus(g.ExpectedStatus) {
		return ErrStatusConflict
	}
	w := g.Work
	w.CreatedAt = cur.CreatedAt
	w.CreatedDate = cur.CreatedDate
	w.CreatedBy = cur.CreatedBy
	cp := *w
	s.work[w.ID] = &cp
	if g.Transition != nil {
		h := *g.Transition
		s.transitions = append(s.transitions, &h)
	}
	for i := range g.Activities {
		a := g.Activities[i]
		if a.Metadata == nil {
			a.Metadata = map[string]any{}
		}
		s.activity = append(s.activity, &a)
	}
	for i := range g.Audits {
		a := g.Audits[i]
		s.audit = append(s.audit, &a)
	}
	if g.Notification != nil && g.Notification.UserID != "" {
		n := *g.Notification
		s.notifications = append(s.notifications, &n)
	}
	return nil
}

func (s *MemoryStore) ApproveIntakeAtomic(_ context.Context, eng *Engagement, in *Intake, expectedStatus string) error {
	if eng == nil || in == nil || expectedStatus == "" {
		return fmt.Errorf("approve intake requires engagement, intake, and expected status")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cur, ok := s.intakes[in.ID]
	if !ok || cur.DeletedAt != nil {
		return fmt.Errorf("intake not found")
	}
	if cur.Status != expectedStatus {
		return ErrIntakeConflict
	}
	if eng.ID == "" {
		eng.ID = newID()
	}
	now := time.Now().UTC()
	eng.CreatedAt, eng.UpdatedAt = now, now
	if eng.Services == nil {
		eng.Services = []string{}
	}
	ecp := *eng
	s.engagements[eng.ID] = &ecp

	in.CreatedAt = cur.CreatedAt
	in.CreatedBy = cur.CreatedBy
	in.UpdatedAt = now
	if in.Payload == nil {
		in.Payload = map[string]any{}
	}
	icp := *in
	s.intakes[in.ID] = &icp
	return nil
}
