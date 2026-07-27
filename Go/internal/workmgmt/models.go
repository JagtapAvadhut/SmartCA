package workmgmt

import "time"

// WorkItem is the primary work entity.
type WorkItem struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	Priority       string     `json:"priority"`
	Status         string     `json:"status"` // practice status (OPEN, IN_PROGRESS, …)
	DueDate        *time.Time `json:"dueDate,omitempty"`
	CreatedDate    time.Time  `json:"createdDate"`
	AssignedBy     string     `json:"assignedBy"`
	AssignedByName string     `json:"assignedByName,omitempty"`
	AssignedTo     string     `json:"assignedTo"`
	AssignedToName string     `json:"assignedToName,omitempty"`
	ClientID       string     `json:"clientId,omitempty"`
	ClientName     string     `json:"clientName"`
	CompanyID      string     `json:"companyId,omitempty"`
	EngagementID   string     `json:"engagementId,omitempty"`
	WorkType       string     `json:"workType,omitempty"`
	PeriodKey      string     `json:"periodKey,omitempty"`
	FY             string     `json:"fy,omitempty"`
	Overlay        string     `json:"overlay,omitempty"`
	RiskClass      string     `json:"riskClass,omitempty"`
	OwnerCAID      string     `json:"ownerCaId,omitempty"`
	TlID           string     `json:"tlId,omitempty"`
	AssigneeID     string     `json:"assigneeId,omitempty"`
	DelegatedClose bool       `json:"delegatedClose,omitempty"`
	RequiresPartnerSignoff bool `json:"requiresPartnerSignoff,omitempty"`
	Department     string     `json:"department"`
	Tags           []string   `json:"tags"`
	EstimatedHours float64    `json:"estimatedHours"`
	ActualHours    float64    `json:"actualHours"`
	CompletionPct  int        `json:"completionPct"`
	ParentID       string     `json:"parentId,omitempty"`
	CreatedBy      string     `json:"createdBy"`
	UpdatedBy      string     `json:"updatedBy"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	DeletedAt      *time.Time `json:"deletedAt,omitempty"`
	DeletedBy      string     `json:"deletedBy,omitempty"`
	ChildCount     int        `json:"childCount,omitempty"`
}

// Engagement is a client retainer / service map (Architecture §5.1).
type Engagement struct {
	ID         string     `json:"id"`
	ClientID   string     `json:"clientId"`
	CompanyID  string     `json:"companyId,omitempty"`
	OwnerCAID  string     `json:"ownerCaId"`
	Services   []string   `json:"services"`
	Status     string     `json:"status"`
	FY         string     `json:"fy,omitempty"`
	Title      string     `json:"title,omitempty"`
	CreatedBy  string     `json:"createdBy"`
	UpdatedBy  string     `json:"updatedBy"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
	DeletedAt  *time.Time `json:"deletedAt,omitempty"`
}

// Intake is a reception pre-master ticket.
type Intake struct {
	ID              string         `json:"id"`
	Status          string         `json:"status"` // INTAKE | APPROVED | REJECTED
	Source          string         `json:"source"`
	ContactName     string         `json:"contactName"`
	ContactPhone    string         `json:"contactPhone,omitempty"`
	ContactEmail    string         `json:"contactEmail,omitempty"`
	Services        []string       `json:"services"`
	Notes           string         `json:"notes,omitempty"`
	Payload         map[string]any `json:"payload,omitempty"`
	CreatedBy       string         `json:"createdBy"`
	ApprovedBy      string         `json:"approvedBy,omitempty"`
	RejectedBy      string         `json:"rejectedBy,omitempty"`
	RejectRemarks   string         `json:"rejectRemarks,omitempty"`
	ClientID        string         `json:"clientId,omitempty"`
	CompanyID       string         `json:"companyId,omitempty"`
	EngagementID    string         `json:"engagementId,omitempty"`
	OwnerCAID       string         `json:"ownerCaId,omitempty"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	DeletedAt       *time.Time     `json:"deletedAt,omitempty"`
}

// ChecklistItem is a document checklist row on a work item.
type ChecklistItem struct {
	ID         string     `json:"id"`
	WorkItemID string     `json:"workItemId"`
	Code       string     `json:"code"`
	Label      string     `json:"label"`
	Status     string     `json:"status"` // pending|received|verified|rejected
	Remarks    string     `json:"remarks,omitempty"`
	VerifiedBy string     `json:"verifiedBy,omitempty"`
	CreatedBy  string     `json:"createdBy"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
	DeletedAt  *time.Time `json:"deletedAt,omitempty"`
}

// WorkTransitionHistory records gated status edges.
type WorkTransitionHistory struct {
	ID         string    `json:"id"`
	WorkItemID string    `json:"workItemId"`
	FromStatus string    `json:"fromStatus"`
	ToStatus   string    `json:"toStatus"`
	Action     string    `json:"action"`
	Remarks    string    `json:"remarks,omitempty"`
	ActorID    string    `json:"actorId"`
	CreatedAt  time.Time `json:"createdAt"`
}

// FollowUp is an unlimited follow-up entry.
type FollowUp struct {
	ID               string     `json:"id"`
	WorkItemID       string     `json:"workItemId"`
	FollowUpDate     string     `json:"followUpDate"`
	FollowUpTime     string     `json:"followUpTime,omitempty"`
	CreatedBy        string     `json:"createdBy"`
	Notes            string     `json:"notes"`
	NextFollowUpDate string     `json:"nextFollowUpDate,omitempty"`
	Reminder         bool       `json:"reminder"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
	DeletedAt        *time.Time `json:"deletedAt,omitempty"`
}

// CallLog stores call history.
type CallLog struct {
	ID              string     `json:"id"`
	WorkItemID      string     `json:"workItemId"`
	CallDate        string     `json:"callDate"`
	CallTime        string     `json:"callTime,omitempty"`
	Direction       string     `json:"direction"`
	DurationMinutes int        `json:"durationMinutes"`
	PersonSpokenTo  string     `json:"personSpokenTo"`
	Designation     string     `json:"designation"`
	PhoneNumber     string     `json:"phoneNumber"`
	Summary         string     `json:"summary"`
	DetailedNotes   string     `json:"detailedNotes"`
	ActionItems     string     `json:"actionItems"`
	NextCallDate    string     `json:"nextCallDate,omitempty"`
	CreatedBy       string     `json:"createdBy"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
	DeletedAt       *time.Time `json:"deletedAt,omitempty"`
}

// EmailLog stores email history.
type EmailLog struct {
	ID          string     `json:"id"`
	WorkItemID  string     `json:"workItemId"`
	EmailDate   string     `json:"emailDate"`
	EmailTime   string     `json:"emailTime,omitempty"`
	From        string     `json:"from"`
	To          string     `json:"to"`
	CC          string     `json:"cc"`
	Subject     string     `json:"subject"`
	Summary     string     `json:"summary"`
	Attachments []string   `json:"attachments"`
	Status      string     `json:"status"`
	CreatedBy   string     `json:"createdBy"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	DeletedAt   *time.Time `json:"deletedAt,omitempty"`
}

// MeetingLog stores meeting history.
type MeetingLog struct {
	ID              string     `json:"id"`
	WorkItemID      string     `json:"workItemId"`
	MeetingDate     string     `json:"meetingDate"`
	MeetingTime     string     `json:"meetingTime,omitempty"`
	Location        string     `json:"location"`
	OnlineLink      string     `json:"onlineLink"`
	Participants    []string   `json:"participants"`
	DiscussionNotes string     `json:"discussionNotes"`
	Decisions       string     `json:"decisions"`
	ActionItems     string     `json:"actionItems"`
	CreatedBy       string     `json:"createdBy"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
	DeletedAt       *time.Time `json:"deletedAt,omitempty"`
}

// Note is a rich-text / markdown work note.
type Note struct {
	ID            string     `json:"id"`
	WorkItemID    string     `json:"workItemId"`
	Body          string     `json:"body"`
	Format        string     `json:"format"`
	AttachmentIDs []string   `json:"attachmentIds"`
	CreatedBy     string     `json:"createdBy"`
	CreatedAt     time.Time  `json:"createdAt"`
	EditedAt      *time.Time `json:"editedAt,omitempty"`
	UpdatedAt     time.Time  `json:"updatedAt"`
	DeletedAt     *time.Time `json:"deletedAt,omitempty"`
}

// Comment is an internal organization comment.
type Comment struct {
	ID         string     `json:"id"`
	WorkItemID string     `json:"workItemId"`
	Body       string     `json:"body"`
	Mentions   []string   `json:"mentions"`
	CreatedBy  string     `json:"createdBy"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
	DeletedAt  *time.Time `json:"deletedAt,omitempty"`
}

// Attachment stores file metadata only (soft delete).
type Attachment struct {
	ID          string     `json:"id"`
	WorkItemID  string     `json:"workItemId"`
	FileName    string     `json:"fileName"`
	ContentType string     `json:"contentType"`
	SizeBytes   int64      `json:"sizeBytes"`
	StoragePath string     `json:"storagePath"`
	Kind        string     `json:"kind"`
	UploadedBy  string     `json:"uploadedBy"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	DeletedAt   *time.Time `json:"deletedAt,omitempty"`
	DeletedBy   string     `json:"deletedBy,omitempty"`
}

// ActivityEvent is an immutable timeline entry.
type ActivityEvent struct {
	ID         string         `json:"id"`
	WorkItemID string         `json:"workItemId"`
	Action     string         `json:"action"`
	Summary    string         `json:"summary"`
	ActorID    string         `json:"actorId"`
	ActorName  string         `json:"actorName"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
}

// AuditEntry is an immutable field-level change record.
type AuditEntry struct {
	ID         string    `json:"id"`
	WorkItemID string    `json:"workItemId,omitempty"`
	EntityType string    `json:"entityType"`
	EntityID   string    `json:"entityId"`
	FieldName  string    `json:"fieldName"`
	OldValue   string    `json:"oldValue"`
	NewValue   string    `json:"newValue"`
	UserID     string    `json:"userId"`
	IPAddress  string    `json:"ipAddress"`
	UserAgent  string    `json:"userAgent"`
	CreatedAt  time.Time `json:"createdAt"`
}

// Notification is a user-targeted work notification.
type Notification struct {
	ID         string     `json:"id"`
	UserID     string     `json:"userId"`
	WorkItemID string     `json:"workItemId,omitempty"`
	Kind       string     `json:"kind"`
	Title      string     `json:"title"`
	Body       string     `json:"body"`
	ReadAt     *time.Time `json:"readAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	DeletedAt  *time.Time `json:"deletedAt,omitempty"`
}

// Actor is the authenticated caller context.
type Actor struct {
	ID          string
	Name        string
	Role        string // raw role from user record
	Hierarchy   string // normalized WM role
	Permissions []string
	DownlineIDs []string // reports_to subtree for portfolio/squad scope
	IP          string
	UserAgent   string
}

// ListFilter supports pagination, sorting, filtering, search.
type ListFilter struct {
	Page           int
	PageSize       int
	Sort           string
	Query          string
	Status         string
	Priority       string
	AssigneeID     string
	// InvolvedUserID limits to rows where the user is assignee, assigner, or creator.
	InvolvedUserID string
	OwnerCAID      string
	TlID           string
	CompanyID      string
	EngagementID   string
	WorkType       string
	PeriodKey      string
	Overlay        string
	RiskClass      string
	// ScopeDownlineIDs expands portfolio/squad visibility.
	ScopeDownlineIDs []string
	ForceEmpty       bool
	ClientID         string
	Department       string
	Role             string
	From             *time.Time
	To               *time.Time
	IncludeDeleted   bool
}

// Page is a generic paginated result.
type Page[T any] struct {
	Items      []T `json:"items"`
	Total      int `json:"total"`
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	TotalPages int `json:"totalPages"`
}

// DashboardStats aggregates role-aware metrics.
// Practice Core: completed/completedTasks = CLOSED (legacy "completed" maps to CLOSED);
// pending/pendingTasks = not CLOSED/CANCELLED; verify/close queues are exposed separately.
type DashboardStats struct {
	Pending                int            `json:"pending"`
	Completed              int            `json:"completed"`
	Overdue                int            `json:"overdue"`
	TodaysWork             int            `json:"todaysWork"`
	MyWork                 int            `json:"myWork"`
	TodaysFollowUps        int            `json:"todaysFollowUps"`
	UpcomingCalls          int            `json:"upcomingCalls"`
	PendingTasks           int            `json:"pendingTasks"`
	CompletedTasks         int            `json:"completedTasks"`
	ReadyForTLVerify       int            `json:"readyForTLVerify"`
	ReadyForCAVerify       int            `json:"readyForCAVerify"`
	ReadyForManagerClose   int            `json:"readyForManagerClose"`
	AwaitingClose          int            `json:"awaitingClose"` // alias of readyForManagerClose
	EmployeePerformance    map[string]int `json:"employeePerformance,omitempty"`
	CAPerformance          map[string]int `json:"caPerformance,omitempty"`
	TeamLeaderPerformance  map[string]int `json:"teamLeaderPerformance,omitempty"`
	DepartmentSummary      map[string]int `json:"departmentSummary,omitempty"`
}

// CreateUserInput is hierarchy-gated user creation for WM team.
type CreateUserInput struct {
	FullName    string `json:"fullName"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        string `json:"role"`
	Department  string `json:"department"`
	Designation string `json:"designation"`
}

// Activity action constants.
const (
	ActionCreated        = "created"
	ActionUpdated        = "updated"
	ActionAssigned       = "assigned"
	ActionReassigned     = "reassigned"
	ActionTransferred    = "transferred"
	ActionCommented      = "comment"
	ActionCall           = "call"
	ActionEmail          = "email"
	ActionMeeting        = "meeting"
	ActionStatusChange   = "status_change"
	ActionPriorityChange = "priority_change"
	ActionUpload         = "upload"
	ActionDownload       = "download"
	ActionRestore        = "restore"
	ActionDelete         = "delete"
	ActionFollowUp       = "followup"
	ActionNote           = "note"
	ActionVerifyTL       = "verify_tl"
	ActionVerifyCA       = "verify_ca"
	ActionClose          = "close"
	ActionReopen         = "reopen"
	ActionIntakeCreate   = "intake_create"
	ActionIntakeApprove  = "intake_approve"
	ActionIntakeReject   = "intake_reject"
	ActionChecklistVerify = "checklist_verify"
)

// Intake statuses.
const (
	IntakeStatusOpen     = "INTAKE"
	IntakeStatusApproved = "APPROVED"
	IntakeStatusRejected = "REJECTED"
)

// Checklist item statuses.
const (
	ChecklistPending  = "pending"
	ChecklistReceived = "received"
	ChecklistVerified = "verified"
	ChecklistRejected = "rejected"
)
