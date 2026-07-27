package workmgmt_test

import (
	"context"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

// BUG-0010: Manager/CA may create unassigned OPEN work; assignee optional via AssignSlot later.
func TestCreateWork_UnassignedOpen(t *testing.T) {
	ctx := context.Background()

	t.Run("manager create without assignee succeeds as OPEN", func(t *testing.T) {
		svc := workmgmt.NewService(workmgmt.NewMemoryStore())
		mgr := actor("U-MGR", workmgmt.RoleManager)
		w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
			Title:      "Intake pending assign",
			ClientID:   "C1",
			ClientName: "Acme",
		}, "")
		if err != nil {
			t.Fatalf("unassigned create: %v", err)
		}
		if w.Status != workmgmt.StatusOpen {
			t.Fatalf("status want OPEN got %q", w.Status)
		}
		if w.AssignedTo != "" || w.AssigneeID != "" {
			t.Fatalf("want empty assignee, got assignedTo=%q assigneeId=%q", w.AssignedTo, w.AssigneeID)
		}
	})

	t.Run("ca create document_pending without assignee", func(t *testing.T) {
		svc := workmgmt.NewService(workmgmt.NewMemoryStore())
		ca := actor("U-CA", workmgmt.RoleCA)
		w, err := svc.CreateWork(ctx, ca, &workmgmt.WorkItem{
			Title:  "Docs pending",
			Status: workmgmt.StatusDocumentPending,
		}, "")
		if err != nil {
			t.Fatalf("unassigned document_pending: %v", err)
		}
		if w.Status != workmgmt.StatusDocumentPending {
			t.Fatalf("status want DOCUMENT_PENDING got %q", w.Status)
		}
		if w.AssigneeID != "" {
			t.Fatalf("want empty assigneeId got %q", w.AssigneeID)
		}
	})

	t.Run("create with assignee still works", func(t *testing.T) {
		svc := workmgmt.NewService(workmgmt.NewMemoryStore())
		mgr := actor("U-MGR", workmgmt.RoleManager)
		w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
			Title:      "Assigned on create",
			AssignedTo: "U-EMP",
		}, workmgmt.RoleEmployee)
		if err != nil {
			t.Fatalf("assigned create: %v", err)
		}
		if w.AssignedTo != "U-EMP" || w.AssigneeID != "U-EMP" {
			t.Fatalf("assignee want U-EMP got assignedTo=%q assigneeId=%q", w.AssignedTo, w.AssigneeID)
		}
	})

	t.Run("employee create still rejected", func(t *testing.T) {
		svc := workmgmt.NewService(workmgmt.NewMemoryStore())
		emp := actor("U-EMP", workmgmt.RoleEmployee)
		if _, err := svc.CreateWork(ctx, emp, &workmgmt.WorkItem{Title: "Nope"}, ""); err == nil {
			t.Fatal("employee must not create work")
		}
	})
}
