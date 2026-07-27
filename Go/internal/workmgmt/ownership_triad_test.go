package workmgmt_test

import (
	"context"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

func TestCreateWork_PopulatesOwnershipTriad(t *testing.T) {
	ctx := context.Background()

	t.Run("explicit triad preserved", func(t *testing.T) {
		svc := workmgmt.NewService(workmgmt.NewMemoryStore())
		mgr := actor("MGR", workmgmt.RoleManager)
		w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
			Title:      "Explicit triad",
			AssignedTo: "EMP-1",
			OwnerCAID:  "CA-EXPLICIT",
			TlID:       "TL-EXPLICIT",
			AssigneeID: "EMP-1",
		}, workmgmt.RoleEmployee)
		if err != nil {
			t.Fatal(err)
		}
		if w.OwnerCAID != "CA-EXPLICIT" || w.TlID != "TL-EXPLICIT" || w.AssigneeID != "EMP-1" {
			t.Fatalf("explicit triad not preserved: owner=%q tl=%q assignee=%q", w.OwnerCAID, w.TlID, w.AssigneeID)
		}
	})

	t.Run("CA actor derives owner_ca; TL assignee derives tl", func(t *testing.T) {
		svc := workmgmt.NewService(workmgmt.NewMemoryStore())
		ca := actor("CA-1", workmgmt.RoleCA)
		w, err := svc.CreateWork(ctx, ca, &workmgmt.WorkItem{
			Title:      "From CA to TL",
			AssignedTo: "TL-1",
		}, workmgmt.RoleTeamLeader)
		if err != nil {
			t.Fatal(err)
		}
		if w.OwnerCAID != "CA-1" {
			t.Fatalf("owner_ca want CA-1 got %q", w.OwnerCAID)
		}
		if w.TlID != "TL-1" {
			t.Fatalf("tl want TL-1 got %q", w.TlID)
		}
		if w.AssigneeID != "TL-1" {
			t.Fatalf("assignee want TL-1 got %q", w.AssigneeID)
		}
	})

	t.Run("TL actor derives tl; assignee_id synced", func(t *testing.T) {
		svc := workmgmt.NewService(workmgmt.NewMemoryStore())
		tl := actor("TL-9", workmgmt.RoleTeamLeader)
		w, err := svc.CreateWork(ctx, tl, &workmgmt.WorkItem{
			Title:      "From TL to Emp",
			AssignedTo: "EMP-9",
		}, workmgmt.RoleEmployee)
		if err != nil {
			t.Fatal(err)
		}
		if w.TlID != "TL-9" {
			t.Fatalf("tl want TL-9 got %q", w.TlID)
		}
		if w.AssigneeID != "EMP-9" {
			t.Fatalf("assignee want EMP-9 got %q", w.AssigneeID)
		}
	})

	t.Run("Manager→CA sets owner from assignee role", func(t *testing.T) {
		svc := workmgmt.NewService(workmgmt.NewMemoryStore())
		mgr := actor("MGR", workmgmt.RoleManager)
		w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
			Title:      "Mgr to CA",
			AssignedTo: "CA-7",
		}, workmgmt.RoleCA)
		if err != nil {
			t.Fatal(err)
		}
		if w.OwnerCAID != "CA-7" {
			t.Fatalf("owner_ca want CA-7 got %q", w.OwnerCAID)
		}
		if w.AssigneeID != "CA-7" {
			t.Fatalf("assignee want CA-7 got %q", w.AssigneeID)
		}
	})
}

func TestApplyOwnershipTriadDefaults_Unit(t *testing.T) {
	ca := actor("CA-A", workmgmt.RoleCA)
	in := &workmgmt.WorkItem{AssignedTo: "TL-B"}
	workmgmt.ApplyOwnershipTriadDefaults(ca, in, workmgmt.RoleTeamLeader)
	if in.OwnerCAID != "CA-A" || in.TlID != "TL-B" || in.AssigneeID != "TL-B" {
		t.Fatalf("derived triad mismatch: %+v", in)
	}
	// Preserve explicit
	in2 := &workmgmt.WorkItem{AssignedTo: "E", OwnerCAID: "KEEP-CA", TlID: "KEEP-TL"}
	workmgmt.ApplyOwnershipTriadDefaults(ca, in2, workmgmt.RoleEmployee)
	if in2.OwnerCAID != "KEEP-CA" || in2.TlID != "KEEP-TL" {
		t.Fatalf("explicit not preserved: %+v", in2)
	}
}
