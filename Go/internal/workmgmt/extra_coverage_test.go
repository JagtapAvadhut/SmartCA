package workmgmt_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

func TestAttachmentSoftDeleteRestoreDownload(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	w, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "Files", AssignedTo: "U-EMP"}, workmgmt.RoleEmployee)
	a, err := svc.AddAttachment(ctx, mgr, &workmgmt.Attachment{
		WorkItemID: w.ID, FileName: "doc.docx", ContentType: "application/msword", StoragePath: "/tmp/doc.docx",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.MarkDownload(ctx, mgr, a.ID); err != nil {
		t.Fatal(err)
	}
	if err := svc.SoftDeleteAttachment(ctx, mgr, a.ID); err != nil {
		t.Fatal(err)
	}
	if err := svc.RestoreAttachment(ctx, mgr, a.ID); err != nil {
		t.Fatal(err)
	}
}

func TestInvalidCallDirection(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	w, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "C", AssignedTo: "U-EMP"}, workmgmt.RoleEmployee)
	if _, err := svc.AddCall(ctx, mgr, &workmgmt.CallLog{WorkItemID: w.ID, CallDate: "2026-01-01", Direction: "sideways"}); err == nil {
		t.Fatal("expected validation error")
	}
}

func TestEmptyCommentRejected(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	w, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "C", AssignedTo: "U-EMP"}, workmgmt.RoleEmployee)
	if _, err := svc.AddComment(ctx, mgr, &workmgmt.Comment{WorkItemID: w.ID, Body: "  "}); err == nil {
		t.Fatal("expected validation")
	}
}

func TestUnsupportedAttachmentRejected(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	w, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "C", AssignedTo: "U-EMP"}, workmgmt.RoleEmployee)
	if _, err := svc.AddAttachment(ctx, mgr, &workmgmt.Attachment{
		WorkItemID: w.ID, FileName: "x.exe", ContentType: "application/octet-stream", StoragePath: "/x",
	}); err == nil {
		t.Fatal("exe must be rejected")
	}
}

func TestCreateRequiresTitle(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	if _, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{AssignedTo: "U"}, workmgmt.RoleEmployee); err == nil {
		t.Fatal("title required")
	}
}

func TestManagerCreateAllRolesAssert(t *testing.T) {
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	for _, role := range []string{workmgmt.RoleManager, workmgmt.RoleCA, workmgmt.RoleTeamLeader, workmgmt.RoleEmployee} {
		t.Run("mgr_create_"+role, func(t *testing.T) {
			if err := svc.AssertCreateUser(mgr, role); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestSortVariants(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	for i := 0; i < 5; i++ {
		_, _ = svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
			Title: fmt.Sprintf("Z-%d", i), AssignedTo: "U", Priority: []string{"low", "urgent"}[i%2],
		}, workmgmt.RoleEmployee)
	}
	for _, sort := range []string{"", "title", "priority", "dueDate"} {
		t.Run("sort_"+sort, func(t *testing.T) {
			if _, err := svc.ListWork(ctx, mgr, workmgmt.ListFilter{Page: 1, PageSize: 10, Sort: sort}); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestTimelineGlobal(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	_, _ = svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "T1", AssignedTo: "U"}, workmgmt.RoleEmployee)
	items, err := svc.Timeline(ctx, mgr, 10)
	if err != nil || len(items) < 1 {
		t.Fatalf("timeline %d %v", len(items), err)
	}
}

func TestEmployeeCannotAssertCreate(t *testing.T) {
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	emp := actor("U-EMP", "employee")
	if err := svc.AssertCreateUser(emp, workmgmt.RoleEmployee); err == nil {
		t.Fatal("employee cannot create users")
	}
}
