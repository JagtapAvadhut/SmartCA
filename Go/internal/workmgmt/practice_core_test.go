package workmgmt_test

import (
	"context"
	"strings"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

func TestPracticeNormalize_ArticleNotTL_PartnerNotManager(t *testing.T) {
	if workmgmt.NormalizeHierarchyRole("article_assistant") == workmgmt.RoleTeamLeader {
		t.Fatal("Article must never normalize to Team Leader")
	}
	if workmgmt.NormalizeHierarchyRole("junior_ca") == workmgmt.RoleTeamLeader {
		t.Fatal("Junior CA must never normalize to Team Leader")
	}
	if workmgmt.NormalizeHierarchyRole("partner") == workmgmt.RoleManager {
		t.Fatal("Partner must not collapse to Manager")
	}
	if workmgmt.NormalizeHierarchyRole("hr") == workmgmt.RoleEmployee {
		t.Fatal("HR must remain hr, not employee")
	}
	if workmgmt.NormalizeHierarchyRole("reception") != workmgmt.RoleReception {
		t.Fatal("reception normalize broken")
	}
}

func TestPracticeRBAC_Negatives(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("MGR", workmgmt.RoleManager)
	hr := actor("HR", workmgmt.RoleHR)
	rec := actor("REC", workmgmt.RoleReception)
	art := actor("ART", workmgmt.RoleArticleAssistant)
	emp := actor("EMP", workmgmt.RoleEmployee)
	jr := actor("JR", workmgmt.RoleJuniorCA)

	w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "GST", AssignedTo: "EMP", WorkType: "GSTR-3B", CompanyID: "CO1", ClientID: "CL1",
		RiskClass: workmgmt.RiskHigh, Status: workmgmt.StatusInProgress,
		OwnerCAID: "CA1", TlID: "TL1", AssigneeID: "EMP",
	}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := svc.CreateWork(ctx, hr, &workmgmt.WorkItem{Title: "X", AssignedTo: "EMP"}, workmgmt.RoleEmployee); err == nil {
		t.Fatal("HR must not create client work")
	}
	if _, err := svc.CreateWork(ctx, rec, &workmgmt.WorkItem{Title: "X", AssignedTo: "EMP"}, workmgmt.RoleEmployee); err == nil {
		t.Fatal("Reception must not create client work")
	}
	if _, err := svc.VerifyTL(ctx, art, w.ID, "pass", ""); err == nil {
		t.Fatal("Article must not TL verify")
	}
	if _, err := svc.VerifyCA(ctx, emp, w.ID, "pass", ""); err == nil {
		t.Fatal("Employee must not CA verify")
	}
	if _, err := svc.CloseWork(ctx, emp, w.ID, ""); err == nil {
		t.Fatal("Employee must not close")
	}
	if _, err := svc.CloseWork(ctx, rec, w.ID, ""); err == nil {
		t.Fatal("Reception must not close")
	}

	// Force CA verify queue then junior on high risk
	w.Status = workmgmt.StatusReadyForCAVerify
	_ = svc // use Transition path
	store := workmgmt.NewMemoryStore()
	svc2 := workmgmt.NewService(store)
	w2, _ := svc2.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "High", AssignedTo: "EMP", RiskClass: workmgmt.RiskHigh, CompanyID: "C", WorkType: "GSTR-3B", ClientID: "CL",
	}, workmgmt.RoleEmployee)
	// manually set status via store
	got, _ := store.GetWork(ctx, w2.ID, false)
	got.Status = workmgmt.StatusReadyForCAVerify
	_ = store.UpdateWork(ctx, got)
	if _, err := svc2.VerifyCA(ctx, jr, w2.ID, "pass", ""); err == nil {
		t.Fatal("Junior CA must not verify high-risk")
	}

	page, _ := svc.ListWork(ctx, hr, workmgmt.ListFilter{Page: 1, PageSize: 50})
	if page.Total != 0 {
		t.Fatalf("HR must list zero works, got %d", page.Total)
	}
	_ = art
}

func TestCloseWork_RequiresPartnerSignoff_BlocksManager(t *testing.T) {
	ctx := context.Background()
	store := workmgmt.NewMemoryStore()
	svc := workmgmt.NewService(store)
	mgr := actor("MGR", workmgmt.RoleManager)
	partner := actor("PTR", workmgmt.RolePartner)

	w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "High partner gate", AssignedTo: "EMP", AssignedToName: "Emp",
		ClientID: "CL1", CompanyID: "CO1", WorkType: "GSTR-3B", PeriodKey: "2026-07",
		RiskClass: workmgmt.RiskHigh, RequiresPartnerSignoff: true,
		OwnerCAID: "CA", TlID: "TL", AssigneeID: "EMP",
		Status: workmgmt.StatusInProgress,
	}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}
	got, err := store.GetWork(ctx, w.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	got.Status = workmgmt.StatusReadyForManagerClose
	if err := store.UpdateWork(ctx, got); err != nil {
		t.Fatal(err)
	}

	if _, err := svc.CloseWork(ctx, mgr, w.ID, "mgr attempt"); err == nil {
		t.Fatal("Manager must not close when requiresPartnerSignoff is set")
	} else if !strings.Contains(strings.ToLower(err.Error()), "partner") && !strings.Contains(strings.ToLower(err.Error()), "forbidden") && !strings.Contains(err.Error(), "work.close.partner") {
		t.Fatalf("expected partner/forbidden error, got %v", err)
	}

	still, err := store.GetWork(ctx, w.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	if still.Status != workmgmt.StatusReadyForManagerClose {
		t.Fatalf("status must remain READY_FOR_MANAGER_CLOSE after Manager deny, got %s", still.Status)
	}

	closed, err := svc.CloseWork(ctx, partner, w.ID, "partner filed")
	if err != nil {
		t.Fatalf("Partner must close when requiresPartnerSignoff: %v", err)
	}
	if closed.Status != workmgmt.StatusClosed {
		t.Fatalf("want CLOSED got %s", closed.Status)
	}
}

func TestVerifyGates_SoD_ManagerAndSameActorCannotBoth(t *testing.T) {
	ctx := context.Background()
	store := workmgmt.NewMemoryStore()
	svc := workmgmt.NewService(store)
	mgr := actor("MGR", workmgmt.RoleManager)
	// Stale grants: Manager must still be blocked even if permissions list includes both verify gates.
	mgr.Permissions = append(workmgmt.PermissionsForRole(workmgmt.RoleManager),
		workmgmt.PermVerifyTL, workmgmt.PermVerifyCA)
	tl := actor("TL", workmgmt.RoleTeamLeader)
	ca := actor("CA", workmgmt.RoleCA)
	partner := actor("PTR", workmgmt.RolePartner)

	for _, p := range workmgmt.PermissionsForRole(workmgmt.RoleManager) {
		if p == workmgmt.PermVerifyTL || p == workmgmt.PermVerifyCA {
			t.Fatalf("Manager default permissions must not include %s", p)
		}
	}

	w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "SoD gates", AssignedTo: "EMP", AssignedToName: "Emp",
		ClientID: "CL1", CompanyID: "CO1", WorkType: "GSTR-3B", PeriodKey: "2026-07",
		RiskClass: workmgmt.RiskMedium, OwnerCAID: "CA", TlID: "TL", AssigneeID: "EMP",
		Status: workmgmt.StatusInProgress,
	}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}
	got, err := store.GetWork(ctx, w.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	got.Status = workmgmt.StatusReadyForTLVerify
	if err := store.UpdateWork(ctx, got); err != nil {
		t.Fatal(err)
	}

	if _, err := svc.VerifyTL(ctx, mgr, w.ID, "pass", ""); err == nil {
		t.Fatal("Manager must not TL verify")
	}
	still, _ := store.GetWork(ctx, w.ID, false)
	if still.Status != workmgmt.StatusReadyForTLVerify {
		t.Fatalf("status must remain READY_FOR_TL_VERIFY after Manager deny, got %s", still.Status)
	}

	w, err = svc.VerifyTL(ctx, tl, w.ID, "pass", "tl ok")
	if err != nil {
		t.Fatalf("TL verify: %v", err)
	}
	if w.Status != workmgmt.StatusReadyForCAVerify {
		t.Fatalf("want READY_FOR_CA_VERIFY got %s", w.Status)
	}

	if _, err := svc.VerifyCA(ctx, mgr, w.ID, "pass", ""); err == nil {
		t.Fatal("Manager must not CA verify")
	}
	still, _ = store.GetWork(ctx, w.ID, false)
	if still.Status != workmgmt.StatusReadyForCAVerify {
		t.Fatalf("status must remain READY_FOR_CA_VERIFY after Manager deny, got %s", still.Status)
	}

	// Same actor with both verify grants cannot self-serve TL + CA alone.
	w2, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "SoD same actor", AssignedTo: "EMP", AssignedToName: "Emp",
		ClientID: "CL1", CompanyID: "CO1", WorkType: "GSTR-3B", PeriodKey: "2026-08",
		RiskClass: workmgmt.RiskMedium, OwnerCAID: "CA", TlID: "TL", AssigneeID: "EMP",
		Status: workmgmt.StatusInProgress,
	}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}
	got2, _ := store.GetWork(ctx, w2.ID, false)
	got2.Status = workmgmt.StatusReadyForTLVerify
	_ = store.UpdateWork(ctx, got2)

	w2, err = svc.VerifyTL(ctx, partner, w2.ID, "pass", "partner tl")
	if err != nil {
		t.Fatalf("Partner TL verify: %v", err)
	}
	if _, err := svc.VerifyCA(ctx, partner, w2.ID, "pass", "partner ca"); err == nil {
		t.Fatal("same actor must not complete both TL and CA verify")
	} else if !strings.Contains(strings.ToLower(err.Error()), "segregation") && !strings.Contains(strings.ToLower(err.Error()), "same actor") {
		t.Fatalf("expected SoD error, got %v", err)
	}
	still2, _ := store.GetWork(ctx, w2.ID, false)
	if still2.Status != workmgmt.StatusReadyForCAVerify {
		t.Fatalf("status must remain READY_FOR_CA_VERIFY after same-actor deny, got %s", still2.Status)
	}

	// Distinct CA verifier completes the chain.
	w2, err = svc.VerifyCA(ctx, ca, w2.ID, "pass", "ca ok")
	if err != nil {
		t.Fatalf("distinct CA verify: %v", err)
	}
	if w2.Status != workmgmt.StatusReadyForManagerClose {
		t.Fatalf("want READY_FOR_MANAGER_CLOSE got %s", w2.Status)
	}
}

func TestPracticeReviewGates_HappyPath(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("MGR", workmgmt.RoleManager)
	ca := actor("CA", workmgmt.RoleCA)
	tl := actor("TL", workmgmt.RoleTeamLeader)
	emp := actor("EMP", workmgmt.RoleEmployee)

	w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "GSTR-3B Jul", AssignedTo: "EMP", AssignedToName: "Emp",
		ClientID: "CL1", CompanyID: "CO1", WorkType: "GSTR-3B", PeriodKey: "2026-07",
		RiskClass: workmgmt.RiskMedium, OwnerCAID: "CA", TlID: "TL", AssigneeID: "EMP",
		Status: workmgmt.StatusInProgress,
	}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatal(err)
	}

	// Free complete via PATCH must fail
	closed := workmgmt.StatusClosed
	if _, err := svc.UpdateWork(ctx, emp, w.ID, workmgmt.WorkPatch{Status: &closed}); err == nil {
		t.Fatal("PATCH to CLOSED must be rejected")
	}

	w, err = svc.Transition(ctx, emp, w.ID, workmgmt.StatusReadyForTLVerify, "prep done", "")
	if err != nil {
		t.Fatal(err)
	}
	if w.Status != workmgmt.StatusReadyForTLVerify {
		t.Fatalf("want READY_FOR_TL_VERIFY got %s", w.Status)
	}

	w, err = svc.VerifyTL(ctx, tl, w.ID, "pass", "ok")
	if err != nil {
		t.Fatal(err)
	}
	if w.Status != workmgmt.StatusReadyForCAVerify {
		t.Fatalf("want READY_FOR_CA_VERIFY got %s", w.Status)
	}

	w, err = svc.VerifyCA(ctx, ca, w.ID, "pass", "ok")
	if err != nil {
		t.Fatal(err)
	}
	if w.Status != workmgmt.StatusReadyForManagerClose {
		t.Fatalf("want READY_FOR_MANAGER_CLOSE got %s", w.Status)
	}

	w, err = svc.CloseWork(ctx, mgr, w.ID, "filed")
	if err != nil {
		t.Fatal(err)
	}
	if w.Status != workmgmt.StatusClosed {
		t.Fatalf("want CLOSED got %s", w.Status)
	}

	if _, err := svc.UpdateWork(ctx, emp, w.ID, workmgmt.WorkPatch{}); err == nil {
		t.Fatal("CLOSED must be immutable for executors")
	}

	w, err = svc.ReopenWork(ctx, mgr, w.ID, "client correction")
	if err != nil {
		t.Fatal(err)
	}
	if w.Status != workmgmt.StatusOpen {
		t.Fatalf("want OPEN got %s", w.Status)
	}
}

func TestPracticeIntake_ReceptionToManager(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	rec := actor("REC", workmgmt.RoleReception)
	mgr := actor("MGR", workmgmt.RoleManager)
	emp := actor("EMP", workmgmt.RoleEmployee)

	in, err := svc.CreateIntake(ctx, rec, &workmgmt.Intake{
		Source: "walk-in", ContactName: "ABC Pvt", Services: []string{"GST", "Books"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if in.Status != workmgmt.IntakeStatusOpen {
		t.Fatalf("want INTAKE got %s", in.Status)
	}

	if _, err := svc.ApproveIntake(ctx, emp, in.ID, "CL1", "CO1", "CA1", "GST retainer", nil); err == nil {
		t.Fatal("employee must not approve intake")
	}

	approved, err := svc.ApproveIntake(ctx, mgr, in.ID, "CL1", "CO1", "CA1", "GST retainer", []string{"GST"})
	if err != nil {
		t.Fatal(err)
	}
	if approved.Status != workmgmt.IntakeStatusApproved || approved.EngagementID == "" {
		t.Fatalf("approve failed: %+v", approved)
	}

	in2, _ := svc.CreateIntake(ctx, rec, &workmgmt.Intake{Source: "call", ContactName: "Reject Me", Services: []string{"ITR"}})
	if _, err := svc.RejectIntake(ctx, mgr, in2.ID, ""); err == nil {
		t.Fatal("reject without remarks must fail")
	}
	rej, err := svc.RejectIntake(ctx, mgr, in2.ID, "spam")
	if err != nil || rej.Status != workmgmt.IntakeStatusRejected {
		t.Fatalf("reject failed: %+v %v", rej, err)
	}
}

func TestPracticeChecklist_VerifyReject(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("MGR", workmgmt.RoleManager)
	tl := actor("TL", workmgmt.RoleTeamLeader)
	art := actor("ART", workmgmt.RoleArticleAssistant)

	w, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Docs", AssignedTo: "EMP", ClientID: "CL", TlID: "TL",
	}, workmgmt.RoleEmployee)
	item, err := svc.AddChecklistItem(ctx, mgr, &workmgmt.ChecklistItem{
		WorkItemID: w.ID, Code: "GSTR_JSON", Label: "GSTR JSON",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.VerifyChecklistItem(ctx, art, w.ID, item.ID, "pass", ""); err == nil {
		t.Fatal("article must not verify checklist")
	}
	if _, err := svc.VerifyChecklistItem(ctx, tl, w.ID, item.ID, "fail", ""); err == nil {
		t.Fatal("reject without remarks must fail")
	}
	got, err := svc.VerifyChecklistItem(ctx, tl, w.ID, item.ID, "fail", "missing invoices")
	if err != nil || got.Status != workmgmt.ChecklistRejected {
		t.Fatalf("reject failed: %+v %v", got, err)
	}
	got, err = svc.VerifyChecklistItem(ctx, tl, w.ID, item.ID, "pass", "")
	if err != nil || got.Status != workmgmt.ChecklistVerified {
		t.Fatalf("verify failed: %+v %v", got, err)
	}
}

func TestPracticeCorporateRequiresCompany(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("MGR", workmgmt.RoleManager)
	_, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "GSTR", AssignedTo: "E", WorkType: "GSTR-3B", ClientID: "CL",
	}, workmgmt.RoleEmployee)
	if err == nil || !strings.Contains(err.Error(), "companyId") {
		t.Fatalf("expected companyId required, got %v", err)
	}
}

func TestPracticeDownlineScope_CA(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(workmgmt.NewMemoryStore())
	mgr := actor("MGR", workmgmt.RoleManager)
	ca := actor("CA1", workmgmt.RoleCA)
	ca.DownlineIDs = []string{"EMP2"}

	mine, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Mine", AssignedTo: "EMP1", OwnerCAID: "CA1", ClientID: "CL",
	}, workmgmt.RoleEmployee)
	down, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Down", AssignedTo: "EMP2", OwnerCAID: "CA2", ClientID: "CL",
	}, workmgmt.RoleEmployee)
	other, _ := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "Other", AssignedTo: "EMP9", OwnerCAID: "CA9", ClientID: "CL",
	}, workmgmt.RoleEmployee)

	page, err := svc.ListWork(ctx, ca, workmgmt.ListFilter{Page: 1, PageSize: 50})
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, w := range page.Items {
		seen[w.ID] = true
	}
	if !seen[mine.ID] || !seen[down.ID] {
		t.Fatalf("CA should see portfolio + downline: %+v", seen)
	}
	if seen[other.ID] {
		t.Fatal("CA must not see unrelated portfolio")
	}
}

func TestPracticeLegacyStatusMapping(t *testing.T) {
	if workmgmt.NormalizePracticeStatus("todo") != workmgmt.StatusOpen {
		t.Fatal("todo→OPEN")
	}
	if workmgmt.NormalizePracticeStatus("completed") != workmgmt.StatusClosed {
		t.Fatal("completed→CLOSED")
	}
	if workmgmt.NormalizePracticeStatus("review") != workmgmt.StatusReadyForTLVerify {
		t.Fatal("review→READY_FOR_TL_VERIFY")
	}
}
