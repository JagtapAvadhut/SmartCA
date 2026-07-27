package workmgmt_test

import (
	"context"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

func TestFirmIsolation_LeadershipCannotSeeOtherFirm(t *testing.T) {
	store := workmgmt.NewMemoryStore()
	svc := workmgmt.NewService(store)
	ctx := context.Background()

	abcMgr := workmgmt.Actor{ID: "ABC-MGR-01", Hierarchy: workmgmt.RoleManager, FirmKey: "ABC", Permissions: workmgmt.PermissionsForRole(workmgmt.RoleManager)}
	wmMgr := workmgmt.Actor{ID: "WM-MGR-0001", Hierarchy: workmgmt.RoleManager, FirmKey: "WM", Permissions: workmgmt.PermissionsForRole(workmgmt.RoleManager)}

	abcWork, err := svc.CreateWork(ctx, abcMgr, &workmgmt.WorkItem{Title: "ABC GST", AssignedTo: "ABC-EMP-01", AssignedBy: "ABC-MGR-01"}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}
	wmWork, err := svc.CreateWork(ctx, wmMgr, &workmgmt.WorkItem{Title: "WM GST", AssignedTo: "WM-EMP-0001", AssignedBy: "WM-MGR-0001"}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}

	abcPage, err := svc.ListWork(ctx, abcMgr, workmgmt.ListFilter{Page: 1, PageSize: 50})
	if err != nil {
		t.Fatal(err)
	}
	for _, w := range abcPage.Items {
		if w.ID == wmWork.ID {
			t.Fatal("ABC manager saw WM work")
		}
	}
	wmPage, err := svc.ListWork(ctx, wmMgr, workmgmt.ListFilter{Page: 1, PageSize: 50})
	if err != nil {
		t.Fatal(err)
	}
	for _, w := range wmPage.Items {
		if w.ID == abcWork.ID {
			t.Fatal("WM manager saw ABC work")
		}
	}

	if _, err := svc.GetWork(ctx, abcMgr, wmWork.ID); err == nil {
		t.Fatal("ABC manager GetWork on WM work should fail")
	}
}
