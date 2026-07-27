package workmgmt

import (
	"context"
	"errors"
	"strings"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
)

func mapGateErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrStatusConflict) || errors.Is(err, ErrIntakeConflict) {
		return apperrors.Conflict(err.Error())
	}
	return err
}

func (s *Service) gateShadows(actor Actor, workID, from, to, action, remarks string) (WorkTransitionHistory, ActivityEvent, AuditEntry) {
	tr := WorkTransitionHistory{
		WorkItemID: workID,
		FromStatus: from,
		ToStatus:   to,
		Action:     action,
		Remarks:    remarks,
		ActorID:    actor.ID,
	}
	act := ActivityEvent{
		WorkItemID: workID,
		Action:     ActionStatusChange,
		Summary:    from + " → " + to,
		ActorID:    actor.ID,
		ActorName:  actor.Name,
		Metadata:   map[string]any{"action": action, "remarks": remarks},
	}
	aud := AuditEntry{
		WorkItemID: workID,
		EntityType: "work_item",
		EntityID:   workID,
		FieldName:  "status",
		OldValue:   from,
		NewValue:   to,
		UserID:     actor.ID,
		IPAddress:  actor.IP,
		UserAgent:  actor.UserAgent,
	}
	return tr, act, aud
}

func (s *Service) gateNotify(userID, workID, kind, title, body string) *Notification {
	if userID == "" {
		return nil
	}
	return &Notification{
		UserID:     userID,
		WorkItemID: workID,
		Kind:       kind,
		Title:      title,
		Body:       body,
	}
}

// Transition moves work along a legal non-verify edge (submit for review, doc pending, etc.).
func (s *Service) Transition(ctx context.Context, actor Actor, id, to, remarks, overlay string) (*WorkItem, error) {
	if err := s.require(actor, PermTransition); err != nil {
		return nil, err
	}
	cur, err := s.store.GetWork(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("work item not found")
	}
	if !canViewWork(actor, cur) {
		return nil, apperrors.Forbidden("cannot transition this work item")
	}
	if IsTerminalStatus(cur.Status) {
		return nil, apperrors.Conflict("terminal work cannot transition; use reopen")
	}
	to = NormalizePracticeStatus(to)
	from := NormalizePracticeStatus(cur.Status)
	expected := cur.Status

	// Submit for TL verify: assignee (or TL/CA/leadership acting).
	if to == StatusReadyForTLVerify {
		assignee := firstNonEmptyStr(cur.AssigneeID, cur.AssignedTo)
		role := NormalizeHierarchyRole(actor.Hierarchy)
		acting := assignee == actor.ID || cur.TlID == actor.ID || cur.OwnerCAID == actor.ID || IsLeadership(role)
		if !acting {
			return nil, apperrors.Forbidden("only assignee (or TL/CA/Manager) may submit for TL verify")
		}
		if !CanTransition(from, to) && from != StatusInProgress && from != StatusDocumentReceived && from != StatusTLRejected {
			return nil, apperrors.Conflict("illegal transition to READY_FOR_TL_VERIFY from " + from)
		}
	} else if !CanTransition(from, to) {
		return nil, apperrors.Conflict("illegal transition " + from + " → " + to)
	}

	if to == StatusCancelled && !IsLeadership(actor.Hierarchy) && !IsProfessional(actor.Hierarchy) {
		return nil, apperrors.Forbidden("only Manager/CA may cancel")
	}

	cur.Status = to
	if overlay != "" {
		cur.Overlay = NormalizeOverlay(overlay)
	}
	cur.UpdatedBy = actor.ID
	tr, act, aud := s.gateShadows(actor, id, from, to, "transition", remarks)
	next := firstNonEmptyStr(cur.TlID, cur.OwnerCAID, cur.AssignedBy)
	if to == StatusReadyForTLVerify {
		next = firstNonEmptyStr(cur.TlID, cur.OwnerCAID)
	}
	if err := s.store.ApplyGateWrite(ctx, GateWrite{
		Work: cur, ExpectedStatus: expected, Transition: &tr,
		Activities: []ActivityEvent{act}, Audits: []AuditEntry{aud},
		Notification: s.gateNotify(next, id, "transition", "Status: "+to, cur.Title),
	}); err != nil {
		if mapped := mapGateErr(err); mapped != err {
			return nil, mapped
		}
		return nil, apperrors.Internal("failed to transition", err)
	}
	return s.store.GetWork(ctx, id, false)
}

// VerifyTL performs TL pass/fail.
func (s *Service) VerifyTL(ctx context.Context, actor Actor, id, decision, remarks string) (*WorkItem, error) {
	if err := s.require(actor, PermVerifyTL); err != nil {
		return nil, err
	}
	pass := strings.EqualFold(decision, "pass")
	fail := strings.EqualFold(decision, "fail")
	if !pass && !fail {
		return nil, apperrors.Validation("decision must be pass or fail")
	}
	if fail && strings.TrimSpace(remarks) == "" {
		return nil, apperrors.Validation("remarks required on TL reject")
	}
	cur, err := s.store.GetWork(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("work item not found")
	}
	toStatus, terr := ApplyTLVerify(cur.Status, pass)
	if terr != nil {
		return nil, terr
	}
	from := NormalizePracticeStatus(cur.Status)
	expected := cur.Status
	cur.Status = toStatus
	cur.UpdatedBy = actor.ID
	tr, act, aud := s.gateShadows(actor, id, from, toStatus, ActionVerifyTL, remarks)
	verifyAct := ActivityEvent{
		WorkItemID: id, Action: ActionVerifyTL, Summary: decision + ": " + remarks,
		ActorID: actor.ID, ActorName: actor.Name,
	}
	notifyID := firstNonEmptyStr(cur.AssigneeID, cur.AssignedTo)
	if pass {
		notifyID = firstNonEmptyStr(cur.OwnerCAID, cur.AssignedBy)
	}
	if err := s.store.ApplyGateWrite(ctx, GateWrite{
		Work: cur, ExpectedStatus: expected, Transition: &tr,
		Activities: []ActivityEvent{act, verifyAct}, Audits: []AuditEntry{aud},
		Notification: s.gateNotify(notifyID, id, "verify_tl", "TL "+decision, cur.Title),
	}); err != nil {
		if mapped := mapGateErr(err); mapped != err {
			return nil, mapped
		}
		return nil, err
	}
	return s.store.GetWork(ctx, id, false)
}

// VerifyCA performs CA pass/fail with risk / delegated close rules.
func (s *Service) VerifyCA(ctx context.Context, actor Actor, id, decision, remarks string) (*WorkItem, error) {
	if err := s.require(actor, PermVerifyCA); err != nil {
		return nil, err
	}
	pass := strings.EqualFold(decision, "pass")
	fail := strings.EqualFold(decision, "fail")
	if !pass && !fail {
		return nil, apperrors.Validation("decision must be pass or fail")
	}
	if fail && strings.TrimSpace(remarks) == "" {
		return nil, apperrors.Validation("remarks required on CA reject")
	}
	cur, err := s.store.GetWork(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("work item not found")
	}
	// Junior CA cannot CA Verify high-risk.
	if NormalizeHierarchyRole(actor.Hierarchy) == RoleJuniorCA &&
		NormalizeRiskClass(cur.RiskClass) == RiskHigh {
		return nil, apperrors.Forbidden("junior CA cannot CA Verify high-risk work")
	}
	toStatus, terr := ApplyCAVerify(cur.Status, cur.RiskClass, cur.DelegatedClose, pass)
	if terr != nil {
		return nil, terr
	}
	from := NormalizePracticeStatus(cur.Status)
	expected := cur.Status
	cur.Status = toStatus
	cur.UpdatedBy = actor.ID
	tr, act, aud := s.gateShadows(actor, id, from, toStatus, ActionVerifyCA, remarks)
	verifyAct := ActivityEvent{
		WorkItemID: id, Action: ActionVerifyCA, Summary: decision + ": " + remarks,
		ActorID: actor.ID, ActorName: actor.Name,
		Metadata: map[string]any{"risk": cur.RiskClass},
	}
	notifyID := firstNonEmptyStr(cur.TlID, cur.AssigneeID, cur.AssignedTo)
	if pass && toStatus == StatusReadyForManagerClose {
		notifyID = cur.AssignedBy
	}
	if err := s.store.ApplyGateWrite(ctx, GateWrite{
		Work: cur, ExpectedStatus: expected, Transition: &tr,
		Activities: []ActivityEvent{act, verifyAct}, Audits: []AuditEntry{aud},
		Notification: s.gateNotify(notifyID, id, "verify_ca", "CA "+decision, cur.Title),
	}); err != nil {
		if mapped := mapGateErr(err); mapped != err {
			return nil, mapped
		}
		return nil, err
	}
	return s.store.GetWork(ctx, id, false)
}

// CloseWork closes med/high (or delivered) work — Manager or Partner.
// When requiresPartnerSignoff is set, only Partner may close (Architecture: flag forces Partner).
func (s *Service) CloseWork(ctx context.Context, actor Actor, id, remarks string) (*WorkItem, error) {
	role := NormalizeHierarchyRole(actor.Hierarchy)
	cur, err := s.store.GetWork(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("work item not found")
	}
	if cur.RequiresPartnerSignoff {
		if err := s.require(actor, PermClosePartner); err != nil {
			return nil, err
		}
		if role != RolePartner {
			return nil, apperrors.Forbidden("partner sign-off required")
		}
	} else {
		if err := s.require(actor, PermCloseManager); err != nil {
			// Partner may close via partner perm (high risk without flag: Partner or Manager)
			if err2 := s.require(actor, PermClosePartner); err2 != nil {
				return nil, err
			}
		}
	}
	toStatus, terr := ApplyClose(cur.Status)
	if terr != nil {
		return nil, terr
	}
	from := NormalizePracticeStatus(cur.Status)
	expected := cur.Status
	cur.Status = toStatus
	cur.CompletionPct = 100
	cur.UpdatedBy = actor.ID
	tr, act, aud := s.gateShadows(actor, id, from, toStatus, ActionClose, remarks)
	closeAct := ActivityEvent{
		WorkItemID: id, Action: ActionClose, Summary: "Closed: " + remarks,
		ActorID: actor.ID, ActorName: actor.Name,
	}
	if err := s.store.ApplyGateWrite(ctx, GateWrite{
		Work: cur, ExpectedStatus: expected, Transition: &tr,
		Activities: []ActivityEvent{act, closeAct}, Audits: []AuditEntry{aud},
		Notification: s.gateNotify(firstNonEmptyStr(cur.OwnerCAID, cur.AssigneeID, cur.AssignedTo), id, "closed", "Work closed", cur.Title),
	}); err != nil {
		if mapped := mapGateErr(err); mapped != err {
			return nil, mapped
		}
		return nil, err
	}
	return s.store.GetWork(ctx, id, false)
}

// ReopenWork reopens CLOSED with mandatory reason.
func (s *Service) ReopenWork(ctx context.Context, actor Actor, id, reason string) (*WorkItem, error) {
	if err := s.require(actor, PermReopen); err != nil {
		return nil, err
	}
	if strings.TrimSpace(reason) == "" {
		return nil, apperrors.Validation("reopen reason is required")
	}
	cur, err := s.store.GetWork(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("work item not found")
	}
	toStatus, terr := ApplyReopen(cur.Status)
	if terr != nil {
		return nil, terr
	}
	from := NormalizePracticeStatus(cur.Status)
	expected := cur.Status
	cur.Status = toStatus
	cur.UpdatedBy = actor.ID
	tr, act, aud := s.gateShadows(actor, id, from, toStatus, ActionReopen, reason)
	reopenAct := ActivityEvent{
		WorkItemID: id, Action: ActionReopen, Summary: reason,
		ActorID: actor.ID, ActorName: actor.Name,
	}
	if err := s.store.ApplyGateWrite(ctx, GateWrite{
		Work: cur, ExpectedStatus: expected, Transition: &tr,
		Activities: []ActivityEvent{act, reopenAct}, Audits: []AuditEntry{aud},
	}); err != nil {
		if mapped := mapGateErr(err); mapped != err {
			return nil, mapped
		}
		return nil, err
	}
	return s.store.GetWork(ctx, id, false)
}

// AssignSlot assigns owner_ca | tl | assignee triad slots.
func (s *Service) AssignSlot(ctx context.Context, actor Actor, id, slot, userID, userName, userRole string) (*WorkItem, error) {
	if err := s.require(actor, PermAssign); err != nil {
		return nil, err
	}
	cur, err := s.store.GetWork(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("work item not found")
	}
	slot = strings.ToLower(strings.TrimSpace(slot))
	role := NormalizeHierarchyRole(actor.Hierarchy)
	switch slot {
	case "owner_ca":
		if !IsLeadership(role) {
			return nil, apperrors.Forbidden("only Manager/Partner may set Owner CA")
		}
		old := cur.OwnerCAID
		cur.OwnerCAID = userID
		s.auditField(ctx, actor, id, "work_item", id, "ownerCaId", old, userID)
	case "tl":
		if !IsLeadership(role) && !IsProfessional(role) {
			return nil, apperrors.Forbidden("only CA/Manager may set TL")
		}
		if !CanAssignTo(actor.Hierarchy, userRole) && NormalizeHierarchyRole(userRole) != RoleTeamLeader {
			return nil, apperrors.Forbidden("cannot assign this role as TL")
		}
		old := cur.TlID
		cur.TlID = userID
		s.auditField(ctx, actor, id, "work_item", id, "tlId", old, userID)
	case "assignee":
		if !CanAssignTo(actor.Hierarchy, userRole) {
			return nil, apperrors.Forbidden("cannot assign work to this role")
		}
		old := firstNonEmptyStr(cur.AssigneeID, cur.AssignedTo)
		cur.AssigneeID = userID
		cur.AssignedTo = userID
		cur.AssignedToName = userName
		cur.AssignedBy = actor.ID
		cur.AssignedByName = actor.Name
		s.auditField(ctx, actor, id, "work_item", id, "assigneeId", old, userID)
		s.notify(ctx, userID, id, "assignment", "New work assigned", cur.Title)
	default:
		return nil, apperrors.Validation("slot must be owner_ca, tl, or assignee")
	}
	cur.UpdatedBy = actor.ID
	if err := s.store.UpdateWork(ctx, cur); err != nil {
		return nil, err
	}
	s.activity(ctx, actor, id, ActionAssigned, "Assigned "+slot+" → "+userName, map[string]any{"slot": slot})
	return s.store.GetWork(ctx, id, false)
}

// --- Intake ---

func (s *Service) CreateIntake(ctx context.Context, actor Actor, in *Intake) (*Intake, error) {
	if err := s.require(actor, PermIntakeCreate); err != nil {
		return nil, err
	}
	in.Status = IntakeStatusOpen
	in.CreatedBy = actor.ID
	if in.Services == nil {
		in.Services = []string{}
	}
	if in.Payload == nil {
		in.Payload = map[string]any{}
	}
	if err := s.store.CreateIntake(ctx, in); err != nil {
		return nil, apperrors.Internal("failed to create intake", err)
	}
	s.auditField(ctx, actor, "", "intake", in.ID, "status", "", IntakeStatusOpen)
	return s.store.GetIntake(ctx, in.ID, false)
}

func (s *Service) ListIntakes(ctx context.Context, actor Actor, status string) ([]Intake, error) {
	role := NormalizeHierarchyRole(actor.Hierarchy)
	if !IsLeadership(role) && role != RoleReception && !hasPerm(actor.Permissions, PermIntakeApprove) {
		if !s.has(actor, PermIntakeCreate) {
			return nil, apperrors.Forbidden("insufficient intake permissions")
		}
	}
	createdBy := ""
	if role == RoleReception {
		createdBy = actor.ID
	}
	return s.store.ListIntakes(ctx, status, createdBy)
}

// ApproveIntake converts intake → engagement linkage (client/company ids provided by caller / Manager).
func (s *Service) ApproveIntake(ctx context.Context, actor Actor, id string, clientID, companyID, ownerCAID, engagementTitle string, services []string) (*Intake, error) {
	if err := s.require(actor, PermIntakeApprove); err != nil {
		return nil, err
	}
	in, err := s.store.GetIntake(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("intake not found")
	}
	if in.Status != IntakeStatusOpen {
		return nil, apperrors.Conflict("intake is not open")
	}
	if strings.TrimSpace(clientID) == "" {
		return nil, apperrors.Validation("clientId is required on approve")
	}
	if strings.TrimSpace(ownerCAID) == "" {
		return nil, apperrors.Validation("ownerCaId is required on approve")
	}
	svcList := services
	if len(svcList) == 0 {
		svcList = in.Services
	}
	eng := &Engagement{
		ClientID:  clientID,
		CompanyID: companyID,
		OwnerCAID: ownerCAID,
		Services:  svcList,
		Status:    "ACTIVE",
		Title:     engagementTitle,
		CreatedBy: actor.ID,
		UpdatedBy: actor.ID,
	}
	if eng.Title == "" {
		eng.Title = "Engagement from intake " + in.ID
	}
	if eng.ID == "" {
		eng.ID = newID()
	}
	in.Status = IntakeStatusApproved
	in.ApprovedBy = actor.ID
	in.ClientID = clientID
	in.CompanyID = companyID
	in.OwnerCAID = ownerCAID
	in.EngagementID = eng.ID
	if err := s.store.ApproveIntakeAtomic(ctx, eng, in, IntakeStatusOpen); err != nil {
		if mapped := mapGateErr(err); mapped != err {
			return nil, mapped
		}
		return nil, apperrors.Internal("failed to approve intake", err)
	}
	s.auditField(ctx, actor, "", "intake", in.ID, "status", IntakeStatusOpen, IntakeStatusApproved)
	s.notify(ctx, ownerCAID, "", "intake_approved", "Intake approved", in.ContactName)
	return s.store.GetIntake(ctx, id, false)
}

func (s *Service) RejectIntake(ctx context.Context, actor Actor, id, remarks string) (*Intake, error) {
	if err := s.require(actor, PermIntakeReject); err != nil {
		return nil, err
	}
	if strings.TrimSpace(remarks) == "" {
		return nil, apperrors.Validation("remarks required on reject")
	}
	in, err := s.store.GetIntake(ctx, id, false)
	if err != nil {
		return nil, apperrors.NotFound("intake not found")
	}
	if in.Status != IntakeStatusOpen {
		return nil, apperrors.Conflict("intake is not open")
	}
	in.Status = IntakeStatusRejected
	in.RejectedBy = actor.ID
	in.RejectRemarks = remarks
	if err := s.store.UpdateIntake(ctx, in); err != nil {
		return nil, err
	}
	s.auditField(ctx, actor, "", "intake", in.ID, "status", IntakeStatusOpen, IntakeStatusRejected)
	s.notify(ctx, in.CreatedBy, "", "intake_rejected", "Intake rejected", remarks)
	return s.store.GetIntake(ctx, id, false)
}

// --- Engagement ---

func (s *Service) CreateEngagement(ctx context.Context, actor Actor, e *Engagement) (*Engagement, error) {
	if err := s.require(actor, PermEngagementCreate); err != nil {
		return nil, err
	}
	if strings.TrimSpace(e.ClientID) == "" {
		return nil, apperrors.Validation("clientId is required")
	}
	if e.Services == nil {
		e.Services = []string{}
	}
	if e.Status == "" {
		e.Status = "ACTIVE"
	}
	e.CreatedBy = actor.ID
	e.UpdatedBy = actor.ID
	if err := s.store.CreateEngagement(ctx, e); err != nil {
		return nil, err
	}
	return s.store.GetEngagement(ctx, e.ID, false)
}

func (s *Service) ListEngagements(ctx context.Context, actor Actor, clientID string) ([]Engagement, error) {
	if err := s.require(actor, PermView); err != nil {
		return nil, err
	}
	owner := ""
	if IsProfessional(actor.Hierarchy) && !IsLeadership(actor.Hierarchy) {
		owner = actor.ID
	}
	return s.store.ListEngagements(ctx, clientID, owner)
}

// --- Checklist ---

func (s *Service) AddChecklistItem(ctx context.Context, actor Actor, c *ChecklistItem) (*ChecklistItem, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, c.WorkItemID, true); err != nil {
		return nil, err
	}
	if strings.TrimSpace(c.Label) == "" && strings.TrimSpace(c.Code) == "" {
		return nil, apperrors.Validation("code or label required")
	}
	if c.Status == "" {
		c.Status = ChecklistPending
	}
	c.CreatedBy = actor.ID
	if err := s.store.AddChecklistItem(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Service) ListChecklist(ctx context.Context, actor Actor, workID string) ([]ChecklistItem, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, false); err != nil {
		return nil, err
	}
	return s.store.ListChecklist(ctx, workID)
}

func (s *Service) VerifyChecklistItem(ctx context.Context, actor Actor, workID, itemID, decision, remarks string) (*ChecklistItem, error) {
	w, err := s.ensureWorkAccess(ctx, actor, workID, false)
	if err != nil {
		return nil, err
	}
	role := NormalizeHierarchyRole(actor.Hierarchy)
	if !IsLeadership(role) && !IsProfessional(role) && role != RoleTeamLeader {
		return nil, apperrors.Forbidden("only TL/CA/Manager may verify checklist")
	}
	pass := strings.EqualFold(decision, "pass") || strings.EqualFold(decision, "verified")
	fail := strings.EqualFold(decision, "fail") || strings.EqualFold(decision, "rejected")
	if !pass && !fail {
		return nil, apperrors.Validation("decision must be pass/fail")
	}
	if fail && strings.TrimSpace(remarks) == "" {
		return nil, apperrors.Validation("remarks required on checklist reject")
	}
	item, err := s.store.GetChecklistItem(ctx, itemID)
	if err != nil || item.WorkItemID != workID {
		return nil, apperrors.NotFound("checklist item not found")
	}
	old := item.Status
	if pass {
		item.Status = ChecklistVerified
	} else {
		item.Status = ChecklistRejected
	}
	item.Remarks = remarks
	item.VerifiedBy = actor.ID
	if err := s.store.UpdateChecklistItem(ctx, item); err != nil {
		return nil, err
	}
	s.auditField(ctx, actor, workID, "checklist", itemID, "status", old, item.Status)
	s.activity(ctx, actor, workID, ActionChecklistVerify, item.Code+": "+item.Status, nil)
	s.notify(ctx, firstNonEmptyStr(w.AssigneeID, w.AssignedTo), workID, "checklist", "Checklist "+item.Status, item.Label)
	if fail && NormalizePracticeStatus(w.Status) == StatusDocumentReceived {
		_, _ = s.Transition(ctx, actor, workID, StatusDocumentPending, "checklist rejected", "")
	}
	return s.store.GetChecklistItem(ctx, itemID)
}
