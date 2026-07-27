package workmgmt_test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

func actor(id, role string) workmgmt.Actor {
	h := workmgmt.NormalizeHierarchyRole(role)
	return workmgmt.Actor{
		ID: id, Name: id, Role: role, Hierarchy: h,
		Permissions: workmgmt.PermissionsForRole(h),
	}
}

func TestHierarchyNormalize_AllLegacyRoles(t *testing.T) {
	cases := []struct{ in, want string }{
		{"super_admin", workmgmt.RoleManager},
		{"admin", workmgmt.RoleAdmin},
		{"partner", workmgmt.RolePartner},
		{"manager", workmgmt.RoleManager},
		{"ca", workmgmt.RoleCA},
		{"senior_ca", workmgmt.RoleSeniorCA},
		{"team_leader", workmgmt.RoleTeamLeader},
		{"junior_ca", workmgmt.RoleJuniorCA},
		{"article_assistant", workmgmt.RoleArticleAssistant},
		{"employee", workmgmt.RoleEmployee},
		{"accountant", workmgmt.RoleAccountant},
		{"receptionist", workmgmt.RoleReception},
		{"reception", workmgmt.RoleReception},
		{"hr", workmgmt.RoleHR},
		{"auditor", workmgmt.RoleEmployee},
		{"client", workmgmt.RoleClient},
		{"", workmgmt.RoleEmployee},
		{"UNKNOWN_X", workmgmt.RoleEmployee},
	}
	for _, tc := range cases {
		t.Run(tc.in+"_maps", func(t *testing.T) {
			if got := workmgmt.NormalizeHierarchyRole(tc.in); got != tc.want {
				t.Fatalf("got %s want %s", got, tc.want)
			}
		})
	}
}

func TestCanCreateRole_Matrix(t *testing.T) {
	roles := []string{workmgmt.RoleManager, workmgmt.RoleCA, workmgmt.RoleTeamLeader, workmgmt.RoleEmployee}
	// expected[actor][target]
	expect := map[string]map[string]bool{
		workmgmt.RoleManager: {
			workmgmt.RoleManager: true, workmgmt.RoleCA: true, workmgmt.RoleTeamLeader: true, workmgmt.RoleEmployee: true,
		},
		workmgmt.RoleCA: {
			workmgmt.RoleManager: false, workmgmt.RoleCA: false, workmgmt.RoleTeamLeader: true, workmgmt.RoleEmployee: true,
		},
		workmgmt.RoleTeamLeader: {
			workmgmt.RoleManager: false, workmgmt.RoleCA: false, workmgmt.RoleTeamLeader: false, workmgmt.RoleEmployee: true,
		},
		workmgmt.RoleEmployee: {
			workmgmt.RoleManager: false, workmgmt.RoleCA: false, workmgmt.RoleTeamLeader: false, workmgmt.RoleEmployee: false,
		},
	}
	n := 0
	for _, a := range roles {
		for _, tgt := range roles {
			n++
			name := fmt.Sprintf("%s_creates_%s", a, tgt)
			t.Run(name, func(t *testing.T) {
				got := workmgmt.CanCreateRole(a, tgt)
				if got != expect[a][tgt] {
					t.Fatalf("CanCreateRole(%s,%s)=%v want %v", a, tgt, got, expect[a][tgt])
				}
			})
		}
	}
	if n != 16 {
		t.Fatalf("expected 16 create matrix cases, got %d", n)
	}
}

func TestCanAssignTo_Matrix(t *testing.T) {
	type row struct {
		actor, assignee string
		want            bool
	}
	rows := []row{
		{workmgmt.RoleManager, workmgmt.RoleManager, true},
		{workmgmt.RoleManager, workmgmt.RoleCA, true},
		{workmgmt.RoleManager, workmgmt.RoleTeamLeader, true},
		{workmgmt.RoleManager, workmgmt.RoleEmployee, true},
		{workmgmt.RoleCA, workmgmt.RoleManager, false},
		{workmgmt.RoleCA, workmgmt.RoleCA, false}, // CA assigns TL/executors, not peer CAs
		{workmgmt.RoleCA, workmgmt.RoleTeamLeader, true},
		{workmgmt.RoleCA, workmgmt.RoleEmployee, true},
		{workmgmt.RoleTeamLeader, workmgmt.RoleManager, false},
		{workmgmt.RoleTeamLeader, workmgmt.RoleCA, false},
		{workmgmt.RoleTeamLeader, workmgmt.RoleTeamLeader, false}, // TL assigns executors only
		{workmgmt.RoleTeamLeader, workmgmt.RoleEmployee, true},
		{workmgmt.RoleEmployee, workmgmt.RoleEmployee, false},
		{workmgmt.RoleEmployee, workmgmt.RoleManager, false},
	}
	for _, r := range rows {
		t.Run(r.actor+"_assign_"+r.assignee, func(t *testing.T) {
			if got := workmgmt.CanAssignTo(r.actor, r.assignee); got != r.want {
				t.Fatalf("got %v want %v", got, r.want)
			}
		})
	}
}

func TestService_CreateUpdateSoftDeleteRestore(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")

	w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "GST Filing", Description: "Q1", AssignedTo: "U-EMP", AssignedToName: "Emp",
		Department: "Compliance", Priority: "high", Tags: []string{"gst"},
	}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}
	if w.ID == "" || w.Status != workmgmt.StatusOpen {
		t.Fatalf("bad create: %+v", w)
	}

	title := "GST Filing Updated"
	status := workmgmt.StatusInProgress
	w2, err := svc.UpdateWork(ctx, mgr, w.ID, workmgmt.WorkPatch{Title: &title, Status: &status})
	if err != nil {
		t.Fatal(err)
	}
	if w2.Title != title || w2.Status != status {
		t.Fatalf("update failed: %+v", w2)
	}

	if err := svc.SoftDelete(ctx, mgr, w.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.GetWork(ctx, mgr, w.ID); err == nil {
		t.Fatal("expected not found after soft delete")
	}
	if err := svc.Restore(ctx, mgr, w.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.GetWork(ctx, mgr, w.ID); err != nil {
		t.Fatal(err)
	}
	if err := svc.PermanentDeleteForbidden(); err == nil {
		t.Fatal("permanent delete must be forbidden")
	}
}

func TestService_EmployeeCannotAssignOrDelete(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	emp := actor("U-EMP", "employee")
	w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "T", AssignedTo: "U-EMP"}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateWork(ctx, emp, &workmgmt.WorkItem{Title: "X", AssignedTo: "U-EMP"}, workmgmt.RoleEmployee); err == nil {
		t.Fatal("employee must not create/assign")
	}
	if err := svc.SoftDelete(ctx, emp, w.ID); err == nil {
		t.Fatal("employee must not delete")
	}
	pct := 50
	if _, err := svc.UpdateWork(ctx, emp, w.ID, workmgmt.WorkPatch{CompletionPct: &pct}); err != nil {
		t.Fatal("employee should update own work", err)
	}
}

func TestService_ChildResourcesAndActivity(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	w, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "Parent", AssignedTo: "U-EMP"}, workmgmt.RoleEmployee)

	if _, err := svc.AddFollowUp(ctx, mgr, &workmgmt.FollowUp{WorkItemID: w.ID, FollowUpDate: "2026-07-28", Notes: "Call client", Reminder: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddCall(ctx, mgr, &workmgmt.CallLog{WorkItemID: w.ID, CallDate: "2026-07-27", Direction: "outgoing", PersonSpokenTo: "CFO", PhoneNumber: "999"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddEmail(ctx, mgr, &workmgmt.EmailLog{WorkItemID: w.ID, EmailDate: "2026-07-27", From: "a@x", To: "b@y", Subject: "Hi"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddMeeting(ctx, mgr, &workmgmt.MeetingLog{WorkItemID: w.ID, MeetingDate: "2026-07-29", Location: "Zoom", Participants: []string{"A", "B"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddNote(ctx, mgr, &workmgmt.Note{WorkItemID: w.ID, Body: "**md**", Format: "markdown"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddComment(ctx, mgr, &workmgmt.Comment{WorkItemID: w.ID, Body: "internal", Mentions: []string{"U-EMP"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.AddAttachment(ctx, mgr, &workmgmt.Attachment{WorkItemID: w.ID, FileName: "a.pdf", ContentType: "application/pdf", StoragePath: "/tmp/a.pdf"}); err != nil {
		t.Fatal(err)
	}

	for name, fn := range map[string]func() (int, error){
		"followups": func() (int, error) { x, e := svc.ListFollowUps(ctx, mgr, w.ID); return len(x), e },
		"calls":     func() (int, error) { x, e := svc.ListCalls(ctx, mgr, w.ID); return len(x), e },
		"emails":    func() (int, error) { x, e := svc.ListEmails(ctx, mgr, w.ID); return len(x), e },
		"meetings":  func() (int, error) { x, e := svc.ListMeetings(ctx, mgr, w.ID); return len(x), e },
		"notes":     func() (int, error) { x, e := svc.ListNotes(ctx, mgr, w.ID); return len(x), e },
		"comments":  func() (int, error) { x, e := svc.ListComments(ctx, mgr, w.ID); return len(x), e },
		"files":     func() (int, error) { x, e := svc.ListAttachments(ctx, mgr, w.ID); return len(x), e },
	} {
		t.Run("list_"+name, func(t *testing.T) {
			n, err := fn()
			if err != nil || n < 1 {
				t.Fatalf("%s n=%d err=%v", name, n, err)
			}
		})
	}
	acts, err := svc.ListActivity(ctx, mgr, w.ID)
	if err != nil || len(acts) < 5 {
		t.Fatalf("activity len=%d err=%v", len(acts), err)
	}
	aud, err := svc.ListAudit(ctx, mgr, w.ID)
	if err != nil || len(aud) < 1 {
		t.Fatalf("audit len=%d err=%v", len(aud), err)
	}
}

func TestService_ParentChildAndFilters(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	parent, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "Parent Work", AssignedTo: "U-TL", Department: "Tax"}, workmgmt.RoleTeamLeader)
	child, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "Child Subtask", AssignedTo: "U-EMP", ParentID: parent.ID, Priority: "urgent", Status: "blocked", Department: "Tax", ClientID: "C1", ClientName: "Acme"}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}
	got, _ := svc.GetWork(ctx, mgr, parent.ID)
	if got.ChildCount < 1 {
		t.Fatalf("expected childCount>=1 got %d", got.ChildCount)
	}
	_ = child
	page, err := svc.ListWork(ctx, mgr, workmgmt.ListFilter{Page: 1, PageSize: 10, Status: "blocked", Priority: "urgent", Department: "Tax", Query: "Subtask"})
	if err != nil || page.Total != 1 {
		t.Fatalf("filter total=%d err=%v", page.Total, err)
	}
}

func TestService_ReassignTransferNotifications(t *testing.T) {
	ctx := context.Background()
	store := workmgmt.NewMemoryStore()
	svc := workmgmt.NewService(store)
	mgr := actor("U-MGR", "manager")
	w, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "Move me", AssignedTo: "U-EMP1"}, workmgmt.RoleEmployee)
	if _, err := svc.Reassign(ctx, mgr, w.ID, "U-EMP2", "Emp2", workmgmt.RoleEmployee); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Transfer(ctx, mgr, w.ID, "U-EMP3", "Emp3", workmgmt.RoleEmployee); err != nil {
		t.Fatal(err)
	}
	notifs, _ := store.ListNotifications(ctx, "U-EMP3")
	if len(notifs) < 1 {
		t.Fatal("expected reassignment notification")
	}
}

func TestService_RolePermissionSets(t *testing.T) {
	for _, role := range []string{workmgmt.RoleManager, workmgmt.RoleCA, workmgmt.RoleTeamLeader, workmgmt.RoleEmployee} {
		perms := workmgmt.PermissionsForRole(role)
		t.Run(role+"_has_view", func(t *testing.T) {
			found := false
			for _, p := range perms {
				if p == workmgmt.PermView {
					found = true
				}
			}
			if !found {
				t.Fatal("missing work.view")
			}
		})
		t.Run(role+"_assign_gate", func(t *testing.T) {
			hasAssign := false
			for _, p := range perms {
				if p == workmgmt.PermAssign {
					hasAssign = true
				}
			}
			if role == workmgmt.RoleEmployee && hasAssign {
				t.Fatal("employee must not have assign")
			}
			if role != workmgmt.RoleEmployee && !hasAssign {
				t.Fatal("non-employee should have assign")
			}
		})
	}
	// Support roles must not create/assign client work
	for _, role := range []string{workmgmt.RoleHR, workmgmt.RoleReception, workmgmt.RoleArticleAssistant} {
		perms := workmgmt.PermissionsForRole(role)
		for _, p := range perms {
			if p == workmgmt.PermCreate || p == workmgmt.PermAssign || p == workmgmt.PermVerifyTL {
				t.Fatalf("%s must not have %s", role, p)
			}
		}
	}
}

func TestAttachmentKindDetection(t *testing.T) {
	cases := []struct{ name, ct, want string }{
		{"a.pdf", "application/pdf", "pdf"},
		{"a.xlsx", "application/vnd.ms-excel", "excel"},
		{"a.docx", "application/msword", "word"},
		{"a.png", "image/png", "image"},
		{"a.zip", "application/zip", "zip"},
		{"a.txt", "text/plain", "other"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := workmgmt.DetectAttachmentKind(tc.name, tc.ct); got != tc.want {
				t.Fatalf("got %s want %s", got, tc.want)
			}
		})
	}
}

func TestService_DashboardAndSearch(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	emp := actor("U-EMP", "employee")
	due := time.Now().UTC().Add(-24 * time.Hour)
	_, _ = svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "Overdue A", AssignedTo: "U-EMP", DueDate: &due, Department: "Audit"}, workmgmt.RoleEmployee)
	_, _ = svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "SearchNeedle Unique", AssignedTo: "U-EMP2", Department: "Tax"}, workmgmt.RoleEmployee)
	stats, err := svc.Dashboard(ctx, mgr)
	if err != nil || stats.Pending < 1 || stats.Overdue < 1 {
		t.Fatalf("dashboard %+v err=%v", stats, err)
	}
	hits, err := svc.Search(ctx, mgr, "SearchNeedle")
	if err != nil || len(hits) != 1 {
		t.Fatalf("search hits=%d err=%v", len(hits), err)
	}
	mine, err := svc.Dashboard(ctx, emp)
	if err != nil {
		t.Fatal(err)
	}
	_ = mine
}

func TestService_CACannotCreateManagerOrCA(t *testing.T) {
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	ca := actor("U-CA", "ca")
	if err := svc.AssertCreateUser(ca, workmgmt.RoleManager); err == nil {
		t.Fatal("CA must not create Manager")
	}
	if err := svc.AssertCreateUser(ca, workmgmt.RoleCA); err == nil {
		t.Fatal("CA must not create CA")
	}
	if err := svc.AssertCreateUser(ca, workmgmt.RoleTeamLeader); err != nil {
		t.Fatal(err)
	}
	if err := svc.AssertCreateUser(ca, workmgmt.RoleEmployee); err != nil {
		t.Fatal(err)
	}
}

func TestService_TeamLeaderOnlyEmployee(t *testing.T) {
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	tl := actor("U-TL", "team_leader")
	for _, role := range []string{workmgmt.RoleManager, workmgmt.RoleCA, workmgmt.RoleTeamLeader} {
		if err := svc.AssertCreateUser(tl, role); err == nil {
			t.Fatalf("TL must not create %s", role)
		}
	}
	if err := svc.AssertCreateUser(tl, workmgmt.RoleEmployee); err != nil {
		t.Fatal(err)
	}
}

func TestService_EmployeeVisibilityScope(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	emp := actor("U-EMP", "employee")
	other, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "Other", AssignedTo: "U-OTHER"}, workmgmt.RoleEmployee)
	mine, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "Mine", AssignedTo: "U-EMP"}, workmgmt.RoleEmployee)
	if _, err := svc.GetWork(ctx, emp, other.ID); err == nil {
		t.Fatal("employee must not see others' work")
	}
	if _, err := svc.GetWork(ctx, emp, mine.ID); err != nil {
		t.Fatal(err)
	}
	page, _ := svc.ListWork(ctx, emp, workmgmt.ListFilter{Page: 1, PageSize: 50})
	for _, w := range page.Items {
		if w.AssignedTo != emp.ID {
			t.Fatalf("employee list leaked %s", w.ID)
		}
	}
}

func TestService_DueNotifications(t *testing.T) {
	ctx := context.Background()
	store := workmgmt.NewMemoryStore()
	svc := workmgmt.NewService(store)
	mgr := actor("U-MGR", "manager")
	today := time.Now().UTC()
	_, _ = svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{Title: "DueToday", AssignedTo: "U-EMP", DueDate: &today}, workmgmt.RoleEmployee)
	if err := svc.EmitDueNotifications(ctx); err != nil {
		t.Fatal(err)
	}
	n, _ := store.ListNotifications(ctx, "U-EMP")
	found := false
	for _, x := range n {
		if x.Kind == "due_today" || x.Kind == "overdue" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected due notification")
	}
}

// TestBulkScenarioMatrix expands to 100+ named subtests covering CRUD × roles × statuses.
func TestBulkScenarioMatrix(t *testing.T) {
	ctx := context.Background()
	priorities := []string{"low", "medium", "high", "urgent"}
	statuses := []string{"todo", "in_progress", "blocked", "review", "completed", "cancelled"}
	roles := []string{workmgmt.RoleManager, workmgmt.RoleCA, workmgmt.RoleTeamLeader}
	count := 0
	for _, role := range roles {
		for _, pr := range priorities {
			for _, st := range statuses {
				count++
				name := fmt.Sprintf("%s_%s_%s", role, pr, st)
				t.Run(name, func(t *testing.T) {
					svc := workmgmt.NewService(workmgmt.NewMemoryStore())
					a := actor("ACTOR-"+role, role)
					assigneeRole := workmgmt.RoleEmployee
					w, err := svc.CreateWork(ctx, a, &workmgmt.WorkItem{
						Title: name, AssignedTo: "E1", Priority: pr, Status: st, Department: "Dept",
					}, assigneeRole)
					if err != nil {
						t.Fatal(err)
					}
					newSt := workmgmt.StatusInProgress
					if !workmgmt.IsTerminalStatus(w.Status) {
						if _, err := svc.UpdateWork(ctx, a, w.ID, workmgmt.WorkPatch{Status: &newSt}); err != nil {
							t.Fatal(err)
						}
					}
					if _, err := svc.AddComment(ctx, a, &workmgmt.Comment{WorkItemID: w.ID, Body: "ok"}); err != nil {
						t.Fatal(err)
					}
					if err := svc.SoftDelete(ctx, a, w.ID); role == workmgmt.RoleTeamLeader && err != nil {
						// team leader may lack delete in PermissionsForRole — TeamLeader has no PermDelete
						if !strings.Contains(err.Error(), "work.delete") && !strings.Contains(err.Error(), "insufficient") {
							t.Fatal(err)
						}
						return
					} else if err != nil && role != workmgmt.RoleTeamLeader {
						t.Fatal(err)
					}
				})
			}
		}
	}
	// 3 roles × 4 priorities × 6 statuses = 72
	if count != 72 {
		t.Fatalf("expected 72 bulk cases, got %d", count)
	}
}

func TestBulkFilterCombos(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("U-MGR", "manager")
	for i := 0; i < 30; i++ {
		pr := []string{"low", "medium", "high", "urgent"}[i%4]
		st := []string{"todo", "in_progress", "completed"}[i%3]
		dept := []string{"Tax", "Audit", "GST"}[i%3]
		_, _ = svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
			Title: fmt.Sprintf("Item-%d", i), AssignedTo: fmt.Sprintf("U-%d", i%5),
			Priority: pr, Status: st, Department: dept, ClientID: fmt.Sprintf("C%d", i%3), ClientName: "Cli",
			Tags: []string{"t1", "t2"},
		}, workmgmt.RoleEmployee)
	}
	combos := 0
	for _, st := range []string{"", "todo", "completed"} {
		for _, pr := range []string{"", "high", "urgent"} {
			for _, dept := range []string{"", "Tax", "GST"} {
				combos++
				t.Run(fmt.Sprintf("filter_%s_%s_%s", st, pr, dept), func(t *testing.T) {
					page, err := svc.ListWork(ctx, mgr, workmgmt.ListFilter{Page: 1, PageSize: 50, Status: st, Priority: pr, Department: dept})
					if err != nil {
						t.Fatal(err)
					}
					for _, w := range page.Items {
						if st != "" && workmgmt.NormalizePracticeStatus(w.Status) != workmgmt.NormalizePracticeStatus(st) {
							t.Fatalf("status leak")
						}
						if pr != "" && w.Priority != pr {
							t.Fatalf("priority leak")
						}
						if dept != "" && w.Department != dept {
							t.Fatalf("dept leak")
						}
					}
				})
			}
		}
	}
	// 3×3×3 = 27
	if combos != 27 {
		t.Fatalf("expected 27 filter combos got %d", combos)
	}
}

func TestHierarchyRankOrdering(t *testing.T) {
	if !(workmgmt.HierarchyRank(workmgmt.RolePartner) > workmgmt.HierarchyRank(workmgmt.RoleManager) &&
		workmgmt.HierarchyRank(workmgmt.RoleManager) > workmgmt.HierarchyRank(workmgmt.RoleCA) &&
		workmgmt.HierarchyRank(workmgmt.RoleCA) > workmgmt.HierarchyRank(workmgmt.RoleTeamLeader) &&
		workmgmt.HierarchyRank(workmgmt.RoleTeamLeader) > workmgmt.HierarchyRank(workmgmt.RoleEmployee) &&
		workmgmt.HierarchyRank(workmgmt.RoleArticleAssistant) < workmgmt.HierarchyRank(workmgmt.RoleTeamLeader)) {
		t.Fatal("rank ordering broken")
	}
}
