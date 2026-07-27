package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/JagtapAvadhut/smartca-backend/internal/api/middleware"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

// WorkHandler exposes Enterprise Work Management APIs.
type WorkHandler struct {
	Svc          *workmgmt.Service
	CreateUserFn func(actor workmgmt.Actor, in workmgmt.CreateUserInput) (models.Record, error)
	// DownlineFn hydrates Actor.DownlineIDs from reports_to / reportsTo (optional).
	DownlineFn func(userID string) []string
}

func actorFrom(r *http.Request) workmgmt.Actor {
	u := middleware.UserFrom(r.Context())
	if u == nil {
		return workmgmt.Actor{}
	}
	role := u.GetString("role")
	perms := []string{}
	if raw, ok := u["permissions"]; ok {
		switch v := raw.(type) {
		case []string:
			perms = v
		case []any:
			for _, item := range v {
				if s, ok := item.(string); ok {
					perms = append(perms, s)
				}
			}
		}
	}
	return workmgmt.Actor{
		ID:          u.GetString("id"),
		Name:        firstNonEmpty(u.GetString("fullName"), u.GetString("name")),
		Role:        role,
		Hierarchy:   workmgmt.NormalizeHierarchyRole(role),
		Permissions: perms,
		IP:          clientIP(r),
		UserAgent:   r.UserAgent(),
	}
}

func (h *WorkHandler) actorFrom(r *http.Request) workmgmt.Actor {
	a := actorFrom(r)
	if h != nil && h.DownlineFn != nil && a.ID != "" {
		a.DownlineIDs = h.DownlineFn(a.ID)
	}
	return a
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func (h *WorkHandler) List(w http.ResponseWriter, r *http.Request) {
	f := workmgmt.ListFilter{
		Page:       queryInt(r, "page", 1),
		PageSize:   queryInt(r, "pageSize", 20),
		Sort:       r.URL.Query().Get("sort"),
		Query:      r.URL.Query().Get("q"),
		Status:     r.URL.Query().Get("status"),
		Priority:   r.URL.Query().Get("priority"),
		AssigneeID: r.URL.Query().Get("assigneeId"),
		ClientID:   r.URL.Query().Get("clientId"),
		Department: r.URL.Query().Get("department"),
		Role:       r.URL.Query().Get("role"),
	}
	page, err := h.Svc.ListWork(r.Context(), h.actorFrom(r), f)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), page)
}

func (h *WorkHandler) Get(w http.ResponseWriter, r *http.Request) {
	item, err := h.Svc.GetWork(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

type createWorkBody struct {
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	Priority       string     `json:"priority"`
	Status         string     `json:"status"`
	DueDate        *time.Time `json:"dueDate"`
	AssignedTo     string     `json:"assignedTo"`
	AssignedToName string     `json:"assignedToName"`
	AssigneeRole   string     `json:"assigneeRole"`
	AssigneeID     string     `json:"assigneeId"`
	ClientID       string     `json:"clientId"`
	ClientName     string     `json:"clientName"`
	CompanyID      string     `json:"companyId"`
	EngagementID   string     `json:"engagementId"`
	WorkType       string     `json:"workType"`
	PeriodKey      string     `json:"periodKey"`
	FY             string     `json:"fy"`
	Overlay        string     `json:"overlay"`
	RiskClass      string     `json:"riskClass"`
	OwnerCAID      string     `json:"ownerCaId"`
	TlID           string     `json:"tlId"`
	DelegatedClose bool       `json:"delegatedClose"`
	RequiresPartnerSignoff bool `json:"requiresPartnerSignoff"`
	Department     string     `json:"department"`
	Tags           []string   `json:"tags"`
	EstimatedHours float64    `json:"estimatedHours"`
	ParentID       string     `json:"parentId"`
}

func (h *WorkHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body createWorkBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	in := &workmgmt.WorkItem{
		Title:          body.Title,
		Description:    body.Description,
		Priority:       body.Priority,
		Status:         body.Status,
		DueDate:        body.DueDate,
		AssignedTo:     body.AssignedTo,
		AssignedToName: body.AssignedToName,
		AssigneeID:     body.AssigneeID,
		ClientID:       body.ClientID,
		ClientName:     body.ClientName,
		CompanyID:      body.CompanyID,
		EngagementID:   body.EngagementID,
		WorkType:       body.WorkType,
		PeriodKey:      body.PeriodKey,
		FY:             body.FY,
		Overlay:        body.Overlay,
		RiskClass:      body.RiskClass,
		OwnerCAID:      body.OwnerCAID,
		TlID:           body.TlID,
		DelegatedClose: body.DelegatedClose,
		RequiresPartnerSignoff: body.RequiresPartnerSignoff,
		Department:     body.Department,
		Tags:           body.Tags,
		EstimatedHours: body.EstimatedHours,
		ParentID:       body.ParentID,
	}
	item, err := h.Svc.CreateWork(r.Context(), h.actorFrom(r), in, body.AssigneeRole)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) Update(w http.ResponseWriter, r *http.Request) {
	var patch workmgmt.WorkPatch
	if err := decodeJSON(r, &patch); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.UpdateWork(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), patch)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

type reassignBody struct {
	AssignedTo     string `json:"assignedTo"`
	AssignedToName string `json:"assignedToName"`
	AssigneeRole   string `json:"assigneeRole"`
}

func (h *WorkHandler) Reassign(w http.ResponseWriter, r *http.Request) {
	var body reassignBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.Reassign(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), body.AssignedTo, body.AssignedToName, body.AssigneeRole)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

func (h *WorkHandler) Transfer(w http.ResponseWriter, r *http.Request) {
	var body reassignBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.Transfer(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), body.AssignedTo, body.AssignedToName, body.AssigneeRole)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

func (h *WorkHandler) Archive(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.SoftDelete(r.Context(), h.actorFrom(r), chi.URLParam(r, "id")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}

func (h *WorkHandler) Restore(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.Restore(r.Context(), h.actorFrom(r), chi.URLParam(r, "id")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}

func (h *WorkHandler) PermanentDelete(w http.ResponseWriter, r *http.Request) {
	apiresponse.Fail(w, rid(r), h.Svc.PermanentDeleteForbidden())
}

func (h *WorkHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := h.Svc.Dashboard(r.Context(), h.actorFrom(r))
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), stats)
}

func (h *WorkHandler) Search(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.Search(r.Context(), h.actorFrom(r), r.URL.Query().Get("q"))
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), items)
}

func (h *WorkHandler) Timeline(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.Timeline(r.Context(), h.actorFrom(r), queryInt(r, "limit", 100))
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), items)
}

func (h *WorkHandler) ListFollowUps(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListFollowUps(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}
func (h *WorkHandler) AddFollowUp(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.FollowUp
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	body.WorkItemID = chi.URLParam(r, "id")
	item, err := h.Svc.AddFollowUp(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) ListCalls(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListCalls(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}
func (h *WorkHandler) AddCall(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.CallLog
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	body.WorkItemID = chi.URLParam(r, "id")
	item, err := h.Svc.AddCall(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) ListEmails(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListEmails(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}
func (h *WorkHandler) AddEmail(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.EmailLog
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	body.WorkItemID = chi.URLParam(r, "id")
	item, err := h.Svc.AddEmail(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) ListMeetings(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListMeetings(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}
func (h *WorkHandler) AddMeeting(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.MeetingLog
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	body.WorkItemID = chi.URLParam(r, "id")
	item, err := h.Svc.AddMeeting(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) ListNotes(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListNotes(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}
func (h *WorkHandler) AddNote(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.Note
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	body.WorkItemID = chi.URLParam(r, "id")
	item, err := h.Svc.AddNote(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) ListComments(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListComments(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}
func (h *WorkHandler) AddComment(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.Comment
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	body.WorkItemID = chi.URLParam(r, "id")
	item, err := h.Svc.AddComment(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) ListAttachments(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListAttachments(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}
func (h *WorkHandler) AddAttachment(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.Attachment
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	body.WorkItemID = chi.URLParam(r, "id")
	item, err := h.Svc.AddAttachment(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) SoftDeleteAttachment(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.SoftDeleteAttachment(r.Context(), h.actorFrom(r), chi.URLParam(r, "attachmentId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}

func (h *WorkHandler) RestoreAttachment(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.RestoreAttachment(r.Context(), h.actorFrom(r), chi.URLParam(r, "attachmentId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}

func (h *WorkHandler) DownloadAttachment(w http.ResponseWriter, r *http.Request) {
	item, err := h.Svc.MarkDownload(r.Context(), h.actorFrom(r), chi.URLParam(r, "attachmentId"))
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

func (h *WorkHandler) ListActivity(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListActivity(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}

func (h *WorkHandler) ListAudit(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListAudit(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}

type createTeamUserBody struct {
	FullName    string `json:"fullName"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        string `json:"role"`
	Department  string `json:"department"`
	Designation string `json:"designation"`
}

// CreateTeamUser validates hierarchy; persists via callback (wired to users collection).
func (h *WorkHandler) CreateTeamUser(w http.ResponseWriter, r *http.Request) {
	var body createTeamUserBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	actor := h.actorFrom(r)
	if err := h.Svc.AssertCreateUser(actor, body.Role); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	if h.CreateUserFn == nil {
		apiresponse.Fail(w, rid(r), apperrors.Internal("user provisioning not configured", nil))
		return
	}
	rec, err := h.CreateUserFn(actor, workmgmt.CreateUserInput{
		FullName: body.FullName, Email: body.Email, Password: body.Password,
		Role: body.Role, Department: body.Department, Designation: body.Designation,
	})
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), rec)
}

func (h *WorkHandler) ArchiveFollowUp(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.SoftDeleteFollowUp(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}
func (h *WorkHandler) RestoreFollowUp(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.RestoreFollowUp(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}
func (h *WorkHandler) UpdateFollowUp(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.FollowUp
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.UpdateFollowUp(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), chi.URLParam(r, "childId"), body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}
func (h *WorkHandler) ArchiveCall(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.SoftDeleteCall(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}
func (h *WorkHandler) RestoreCall(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.RestoreCall(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}
func (h *WorkHandler) ArchiveEmail(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.SoftDeleteEmail(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}
func (h *WorkHandler) RestoreEmail(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.RestoreEmail(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}
func (h *WorkHandler) ArchiveMeeting(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.SoftDeleteMeeting(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}
func (h *WorkHandler) RestoreMeeting(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.RestoreMeeting(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}
func (h *WorkHandler) CancelMeeting(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.CancelMeeting(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "cancelled"})
}
func (h *WorkHandler) ArchiveNote(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.SoftDeleteNote(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}
func (h *WorkHandler) RestoreNote(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.RestoreNote(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}
func (h *WorkHandler) UpdateNote(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Body string `json:"body"`
	}
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.UpdateNoteOnWork(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), chi.URLParam(r, "childId"), body.Body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}
func (h *WorkHandler) ArchiveComment(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.SoftDeleteComment(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}
func (h *WorkHandler) RestoreComment(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.RestoreComment(r.Context(), h.actorFrom(r), chi.URLParam(r, "childId")); err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}

// --- Practice Core handlers ---

type transitionBody struct {
	To      string `json:"to"`
	Remarks string `json:"remarks"`
	Overlay string `json:"overlay"`
}

func (h *WorkHandler) Transition(w http.ResponseWriter, r *http.Request) {
	var body transitionBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.Transition(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), body.To, body.Remarks, body.Overlay)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

type verifyBody struct {
	Decision string `json:"decision"`
	Remarks  string `json:"remarks"`
}

func (h *WorkHandler) VerifyTL(w http.ResponseWriter, r *http.Request) {
	var body verifyBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.VerifyTL(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), body.Decision, body.Remarks)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

func (h *WorkHandler) VerifyCA(w http.ResponseWriter, r *http.Request) {
	var body verifyBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.VerifyCA(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), body.Decision, body.Remarks)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

type closeBody struct {
	Remarks string `json:"remarks"`
}

func (h *WorkHandler) Close(w http.ResponseWriter, r *http.Request) {
	var body closeBody
	_ = decodeJSON(r, &body)
	item, err := h.Svc.CloseWork(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), body.Remarks)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

type reopenBody struct {
	Reason string `json:"reason"`
}

func (h *WorkHandler) Reopen(w http.ResponseWriter, r *http.Request) {
	var body reopenBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.ReopenWork(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), body.Reason)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

type assignSlotBody struct {
	Slot           string `json:"slot"`
	UserID         string `json:"userId"`
	UserName       string `json:"userName"`
	UserRole       string `json:"userRole"`
}

func (h *WorkHandler) AssignSlot(w http.ResponseWriter, r *http.Request) {
	var body assignSlotBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.AssignSlot(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), body.Slot, body.UserID, body.UserName, body.UserRole)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

func (h *WorkHandler) CreateIntake(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.Intake
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.CreateIntake(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) ListIntakes(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListIntakes(r.Context(), h.actorFrom(r), r.URL.Query().Get("status"))
	writeListOrErr(w, r, items, err)
}

type approveIntakeBody struct {
	ClientID         string   `json:"clientId"`
	CompanyID        string   `json:"companyId"`
	OwnerCAID        string   `json:"ownerCaId"`
	EngagementTitle  string   `json:"engagementTitle"`
	Services         []string `json:"services"`
}

func (h *WorkHandler) ApproveIntake(w http.ResponseWriter, r *http.Request) {
	var body approveIntakeBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.ApproveIntake(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"),
		body.ClientID, body.CompanyID, body.OwnerCAID, body.EngagementTitle, body.Services)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

func (h *WorkHandler) RejectIntake(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Remarks string `json:"remarks"`
	}
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.RejectIntake(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), body.Remarks)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

func (h *WorkHandler) CreateEngagement(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.Engagement
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.CreateEngagement(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) ListEngagements(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListEngagements(r.Context(), h.actorFrom(r), r.URL.Query().Get("clientId"))
	writeListOrErr(w, r, items, err)
}

func (h *WorkHandler) ListChecklist(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListChecklist(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"))
	writeListOrErr(w, r, items, err)
}

func (h *WorkHandler) AddChecklist(w http.ResponseWriter, r *http.Request) {
	var body workmgmt.ChecklistItem
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	body.WorkItemID = chi.URLParam(r, "id")
	item, err := h.Svc.AddChecklistItem(r.Context(), h.actorFrom(r), &body)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.Created(w, rid(r), item)
}

func (h *WorkHandler) VerifyChecklist(w http.ResponseWriter, r *http.Request) {
	var body verifyBody
	if err := decodeJSON(r, &body); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	item, err := h.Svc.VerifyChecklistItem(r.Context(), h.actorFrom(r), chi.URLParam(r, "id"), chi.URLParam(r, "cid"), body.Decision, body.Remarks)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), item)
}

func writeListOrErr[T any](w http.ResponseWriter, r *http.Request, items []T, err error) {
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), items)
}

func queryInt(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return def
	}
	return n
}
