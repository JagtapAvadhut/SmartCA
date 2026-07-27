package workmgmt

import (
	"errors"
	"time"
)

// ErrStatusConflict indicates an optimistic status guard failed (concurrent gate).
var ErrStatusConflict = errors.New("work status conflict")

// ErrIntakeConflict indicates intake was no longer in the expected status.
var ErrIntakeConflict = errors.New("intake status conflict")

// GateWrite is a transactional status gate mutation (verify/close/transition/reopen).
type GateWrite struct {
	Work           *WorkItem
	ExpectedStatus string
	Transition     *WorkTransitionHistory
	Activities     []ActivityEvent
	Audits         []AuditEntry
	Notification   *Notification // optional
}

func stampGateWrite(g *GateWrite) {
	now := time.Now().UTC()
	if g.Work != nil {
		g.Work.UpdatedAt = now
		if g.Work.AssigneeID == "" {
			g.Work.AssigneeID = g.Work.AssignedTo
		}
	}
	if g.Transition != nil {
		if g.Transition.ID == "" {
			g.Transition.ID = newID()
		}
		g.Transition.CreatedAt = now
	}
	for i := range g.Activities {
		if g.Activities[i].ID == "" {
			g.Activities[i].ID = newID()
		}
		g.Activities[i].CreatedAt = now
	}
	for i := range g.Audits {
		if g.Audits[i].ID == "" {
			g.Audits[i].ID = newID()
		}
		g.Audits[i].CreatedAt = now
	}
	if g.Notification != nil {
		if g.Notification.ID == "" {
			g.Notification.ID = newID()
		}
		g.Notification.CreatedAt = now
	}
}
