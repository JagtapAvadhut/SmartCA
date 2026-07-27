package workmgmt_test

import (
	"context"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

func TestDashboard_PracticeAwareAggregates(t *testing.T) {
	ctx := context.Background()
	store := workmgmt.NewMemoryStore()
	svc := workmgmt.NewService(store)
	mgr := actor("MGR-DASH", workmgmt.RoleManager)

	seed := func(title, status string) {
		t.Helper()
		w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
			Title: title, AssignedTo: "EMP-DASH", ClientID: "CL-DASH", CompanyID: "CO-DASH", WorkType: "GSTR-3B",
		}, workmgmt.RoleEmployee)
		if err != nil {
			t.Fatalf("create %s: %v", title, err)
		}
		got, err := store.GetWork(ctx, w.ID, false)
		if err != nil {
			t.Fatal(err)
		}
		got.Status = status
		if err := store.UpdateWork(ctx, got); err != nil {
			t.Fatal(err)
		}
	}

	seed("open", workmgmt.StatusOpen)
	seed("tl-queue", workmgmt.StatusReadyForTLVerify)
	seed("ca-queue", workmgmt.StatusReadyForCAVerify)
	seed("mgr-close-1", workmgmt.StatusReadyForManagerClose)
	seed("mgr-close-2", workmgmt.StatusReadyForManagerClose)
	seed("closed", workmgmt.StatusClosed)
	seed("cancelled", workmgmt.StatusCancelled)
	seed("legacy-completed", "completed") // NormalizePracticeStatus → CLOSED

	stats, err := svc.Dashboard(ctx, mgr)
	if err != nil {
		t.Fatal(err)
	}

	// completed = CLOSED (+ legacy completed); CANCELLED excluded from pending
	if stats.Completed != 2 || stats.CompletedTasks != 2 {
		t.Fatalf("completed=%d completedTasks=%d want 2/2 (CLOSED + legacy completed)", stats.Completed, stats.CompletedTasks)
	}
	// pending = OPEN + TL + CA + 2×READY_FOR_MANAGER_CLOSE = 5 (not CLOSED/CANCELLED)
	if stats.Pending != 5 || stats.PendingTasks != 5 {
		t.Fatalf("pending=%d pendingTasks=%d want 5/5", stats.Pending, stats.PendingTasks)
	}
	if stats.ReadyForTLVerify != 1 {
		t.Fatalf("readyForTLVerify=%d want 1", stats.ReadyForTLVerify)
	}
	if stats.ReadyForCAVerify != 1 {
		t.Fatalf("readyForCAVerify=%d want 1", stats.ReadyForCAVerify)
	}
	if stats.ReadyForManagerClose != 2 || stats.AwaitingClose != 2 {
		t.Fatalf("readyForManagerClose=%d awaitingClose=%d want 2/2", stats.ReadyForManagerClose, stats.AwaitingClose)
	}
	// Regression: close queue must be visible when completed is small
	if stats.Completed < 1 && stats.ReadyForManagerClose == 0 {
		t.Fatal("dashboard must not hide READY_FOR_MANAGER_CLOSE behind completed≈0")
	}
}
