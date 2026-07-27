package workmgmt

import "context"

// Store is the persistence port for work management.
type Store interface {
	CreateWork(ctx context.Context, w *WorkItem) error
	UpdateWork(ctx context.Context, w *WorkItem) error
	GetWork(ctx context.Context, id string, includeDeleted bool) (*WorkItem, error)
	ListWork(ctx context.Context, f ListFilter) (Page[WorkItem], error)
	SoftDeleteWork(ctx context.Context, id, by string) error
	RestoreWork(ctx context.Context, id string) error
	CountChildren(ctx context.Context, parentID string) (int, error)

	AddFollowUp(ctx context.Context, f *FollowUp) error
	UpdateFollowUp(ctx context.Context, f *FollowUp) error
	ListFollowUps(ctx context.Context, workID string) ([]FollowUp, error)
	SoftDeleteFollowUp(ctx context.Context, id, by string) error
	RestoreFollowUp(ctx context.Context, id string) error

	AddCall(ctx context.Context, c *CallLog) error
	ListCalls(ctx context.Context, workID string) ([]CallLog, error)
	SoftDeleteCall(ctx context.Context, id, by string) error
	RestoreCall(ctx context.Context, id string) error

	AddEmail(ctx context.Context, e *EmailLog) error
	ListEmails(ctx context.Context, workID string) ([]EmailLog, error)
	SoftDeleteEmail(ctx context.Context, id, by string) error
	RestoreEmail(ctx context.Context, id string) error

	AddMeeting(ctx context.Context, m *MeetingLog) error
	ListMeetings(ctx context.Context, workID string) ([]MeetingLog, error)
	SoftDeleteMeeting(ctx context.Context, id, by string) error
	RestoreMeeting(ctx context.Context, id string) error

	AddNote(ctx context.Context, n *Note) error
	UpdateNote(ctx context.Context, n *Note) error
	ListNotes(ctx context.Context, workID string) ([]Note, error)
	SoftDeleteNote(ctx context.Context, id, by string) error
	RestoreNote(ctx context.Context, id string) error

	AddComment(ctx context.Context, c *Comment) error
	ListComments(ctx context.Context, workID string) ([]Comment, error)
	SoftDeleteComment(ctx context.Context, id, by string) error
	RestoreComment(ctx context.Context, id string) error

	AddAttachment(ctx context.Context, a *Attachment) error
	ListAttachments(ctx context.Context, workID string) ([]Attachment, error)
	GetAttachment(ctx context.Context, id string, includeDeleted bool) (*Attachment, error)
	SoftDeleteAttachment(ctx context.Context, id, by string) error
	RestoreAttachment(ctx context.Context, id string) error

	AddActivity(ctx context.Context, a *ActivityEvent) error
	ListActivity(ctx context.Context, workID string) ([]ActivityEvent, error)
	ListGlobalActivity(ctx context.Context, limit int) ([]ActivityEvent, error)

	AddAudit(ctx context.Context, a *AuditEntry) error
	ListAudit(ctx context.Context, workID string) ([]AuditEntry, error)

	AddNotification(ctx context.Context, n *Notification) error
	ListNotifications(ctx context.Context, userID string) ([]Notification, error)

	Dashboard(ctx context.Context, actor Actor, today string) (DashboardStats, error)
	Search(ctx context.Context, actor Actor, q string, limit int) ([]WorkItem, error)

	// Practice Core (007+)
	CreateEngagement(ctx context.Context, e *Engagement) error
	UpdateEngagement(ctx context.Context, e *Engagement) error
	GetEngagement(ctx context.Context, id string, includeDeleted bool) (*Engagement, error)
	ListEngagements(ctx context.Context, clientID, ownerCAID string) ([]Engagement, error)

	CreateIntake(ctx context.Context, in *Intake) error
	UpdateIntake(ctx context.Context, in *Intake) error
	GetIntake(ctx context.Context, id string, includeDeleted bool) (*Intake, error)
	ListIntakes(ctx context.Context, status, createdBy string) ([]Intake, error)

	AddChecklistItem(ctx context.Context, c *ChecklistItem) error
	UpdateChecklistItem(ctx context.Context, c *ChecklistItem) error
	GetChecklistItem(ctx context.Context, id string) (*ChecklistItem, error)
	ListChecklist(ctx context.Context, workID string) ([]ChecklistItem, error)

	AddTransitionHistory(ctx context.Context, h *WorkTransitionHistory) error
	ListTransitionHistory(ctx context.Context, workID string) ([]WorkTransitionHistory, error)

	// ApplyGateWrite persists status update + transition/activity/audit/notification in one unit.
	// Postgres: single DB transaction with FOR UPDATE + UPDATE … WHERE status = expected.
	// Returns ErrStatusConflict when expected status no longer matches (map to 409).
	ApplyGateWrite(ctx context.Context, g GateWrite) error
	// ApproveIntakeAtomic creates engagement + updates intake (status must still be expected) atomically.
	ApproveIntakeAtomic(ctx context.Context, eng *Engagement, in *Intake, expectedStatus string) error
}
