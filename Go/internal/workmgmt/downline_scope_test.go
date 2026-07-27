package workmgmt_test

import (
	"context"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

func TestCollectDownlineIDs_Tree(t *testing.T) {
	// Manager → CA → TL → Emp (+ sibling branch)
	reportsTo := map[string]string{
		"CA1":  "MGR",
		"CA2":  "MGR",
		"TL1":  "CA1",
		"TL2":  "CA1",
		"EMP1": "TL1",
		"EMP2": "TL1",
		"EMP3": "TL2",
		"EMP9": "TL9", // unrelated
		"TL9":  "CA9",
	}
	got := workmgmt.CollectDownlineIDs(reportsTo, "CA1")
	want := map[string]bool{"TL1": true, "TL2": true, "EMP1": true, "EMP2": true, "EMP3": true}
	if len(got) != len(want) {
		t.Fatalf("CA1 downline size=%d want %d: %v", len(got), len(want), got)
	}
	for _, id := range got {
		if !want[id] {
			t.Fatalf("unexpected downline member %s in %v", id, got)
		}
	}
	tl := workmgmt.CollectDownlineIDs(reportsTo, "TL1")
	if len(tl) != 2 {
		t.Fatalf("TL1 downline want EMP1,EMP2 got %v", tl)
	}
	if workmgmt.CollectDownlineIDs(reportsTo, "EMP1") != nil && len(workmgmt.CollectDownlineIDs(reportsTo, "EMP1")) != 0 {
		t.Fatal("leaf should have empty downline")
	}
}

func TestCollectDownlineIDs_CycleSafe(t *testing.T) {
	reportsTo := map[string]string{"A": "B", "B": "A", "C": "A"}
	got := workmgmt.CollectDownlineIDs(reportsTo, "A")
	seen := map[string]bool{}
	for _, id := range got {
		if seen[id] {
			t.Fatalf("duplicate %s", id)
		}
		seen[id] = true
	}
	if !seen["B"] || !seen["C"] {
		t.Fatalf("expected B,C got %v", got)
	}
}

func TestReportsToFromFields(t *testing.T) {
	if workmgmt.ReportsToFromFields("X", "Y") != "X" {
		t.Fatal("prefer camelCase reportsTo")
	}
	if workmgmt.ReportsToFromFields("", "Y") != "Y" {
		t.Fatal("fallback reports_to")
	}
}

func TestListScope_CA_PortfolioPlusDownline(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("MGR", workmgmt.RoleManager)
	ca := actor("CA1", workmgmt.RoleCA)
	ca.DownlineIDs = workmgmt.CollectDownlineIDs(map[string]string{
		"TL1": "CA1", "EMP1": "TL1", "EMP2": "TL1",
	}, "CA1")

	portfolio, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Portfolio", AssignedTo: "CA1", OwnerCAID: "CA1", AssigneeID: "CA1", ClientID: "CL",
	}, workmgmt.RoleCA)
	downTL, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Down TL", AssignedTo: "TL1", OwnerCAID: "CA2", TlID: "TL1", AssigneeID: "TL1", ClientID: "CL",
	}, workmgmt.RoleTeamLeader)
	downEmp, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Down Emp", AssignedTo: "EMP1", OwnerCAID: "CA9", TlID: "TL9", AssigneeID: "EMP1", ClientID: "CL",
	}, workmgmt.RoleEmployee)
	other, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Other", AssignedTo: "EMP9", OwnerCAID: "CA9", TlID: "TL9", AssigneeID: "EMP9", ClientID: "CL",
	}, workmgmt.RoleEmployee)

	page, err := svc.ListWork(ctx, ca, workmgmt.ListFilter{Page: 1, PageSize: 50})
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, w := range page.Items {
		seen[w.ID] = true
	}
	if !seen[portfolio.ID] || !seen[downTL.ID] || !seen[downEmp.ID] {
		t.Fatalf("CA should see portfolio + downline assignees: %+v total=%d", seen, page.Total)
	}
	if seen[other.ID] {
		t.Fatal("CA must not see unrelated work")
	}
}

func TestListScope_TL_TeamPlusDownline(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("MGR", workmgmt.RoleManager)
	tl := actor("TL1", workmgmt.RoleTeamLeader)
	tl.DownlineIDs = workmgmt.CollectDownlineIDs(map[string]string{
		"EMP1": "TL1", "EMP2": "TL1",
	}, "TL1")

	team, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Team", AssignedTo: "TL1", OwnerCAID: "CA1", TlID: "TL1", AssigneeID: "TL1", ClientID: "CL",
	}, workmgmt.RoleTeamLeader)
	down, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Down", AssignedTo: "EMP1", OwnerCAID: "CA9", TlID: "TL9", AssigneeID: "EMP1", ClientID: "CL",
	}, workmgmt.RoleEmployee)
	other, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Other", AssignedTo: "EMP9", OwnerCAID: "CA9", TlID: "TL9", AssigneeID: "EMP9", ClientID: "CL",
	}, workmgmt.RoleEmployee)

	page, err := svc.ListWork(ctx, tl, workmgmt.ListFilter{Page: 1, PageSize: 50})
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, w := range page.Items {
		seen[w.ID] = true
	}
	if !seen[team.ID] || !seen[down.ID] {
		t.Fatalf("TL should see team + downline: %+v", seen)
	}
	if seen[other.ID] {
		t.Fatal("TL must not see unrelated work")
	}
}
