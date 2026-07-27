package workmgmt_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
	_ "github.com/lib/pq"
)

var bug13Seq atomic.Uint64

// TestConcurrentGateWrite_Conflict proves ApplyGateWrite / VerifyTL / CloseWork
// reject a second concurrent gate on the same work (one success, one 409 Conflict).
// MemoryStore always runs; Postgres runs when DATABASE_URL is set or local DSN answers.
func TestConcurrentGateWrite_Conflict(t *testing.T) {
	t.Run("memory_ApplyGateWrite", func(t *testing.T) {
		assertConcurrentApplyGateWrite(t, workmgmt.NewMemoryStore(), "", "")
	})
	t.Run("memory_VerifyTL", func(t *testing.T) {
		assertConcurrentVerifyTL(t, workmgmt.NewMemoryStore(), "", "")
	})
	t.Run("memory_CloseWork", func(t *testing.T) {
		assertConcurrentClose(t, workmgmt.NewMemoryStore(), "", "")
	})

	db, clientID, companyID := openOptionalPostgres(t)
	if db == nil {
		return
	}
	defer db.Close()
	store := workmgmt.NewPostgresStore(db)
	t.Run("postgres_ApplyGateWrite", func(t *testing.T) {
		assertConcurrentApplyGateWrite(t, store, clientID, companyID)
	})
	t.Run("postgres_VerifyTL", func(t *testing.T) {
		assertConcurrentVerifyTL(t, store, clientID, companyID)
	})
	t.Run("postgres_CloseWork", func(t *testing.T) {
		assertConcurrentClose(t, store, clientID, companyID)
	})
}

func assertConcurrentApplyGateWrite(t *testing.T, store workmgmt.Store, clientID, companyID string) {
	t.Helper()
	ctx := context.Background()
	clientID, companyID = seedRefs(clientID, companyID)
	id := "BUG13-GATE-" + uniqueSuffix()
	now := time.Now().UTC()
	w := &workmgmt.WorkItem{
		ID: id, Title: "BUG-0013 concurrent gate", Status: workmgmt.StatusReadyForTLVerify,
		Priority: "medium", RiskClass: workmgmt.RiskMedium,
		AssignedBy: "MGR", AssignedTo: "EMP",
		ClientID: clientID, CompanyID: companyID, WorkType: "GSTR-3B",
		PeriodKey: "BUG13-" + uniqueSuffix(), OwnerCAID: "CA", TlID: "TL", AssigneeID: "EMP",
		CreatedBy: "MGR", UpdatedBy: "MGR", CreatedAt: now, UpdatedAt: now, CreatedDate: now,
	}
	if err := store.CreateWork(ctx, w); err != nil {
		t.Fatalf("CreateWork: %v", err)
	}
	t.Cleanup(func() { _ = store.SoftDeleteWork(ctx, id, "BUG13") })

	// Two-phase barrier: both goroutines ready before either ApplyGateWrite.
	var ready sync.WaitGroup
	ready.Add(2)
	start := make(chan struct{})
	errs := make([]error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			ready.Done()
			<-start
			cur, err := store.GetWork(ctx, id, false)
			if err != nil {
				errs[idx] = err
				return
			}
			// Always claim the pre-gate status — do not trust a late GetWork read.
			cur.Status = workmgmt.StatusReadyForCAVerify
			cur.UpdatedBy = fmt.Sprintf("TL-%d", idx)
			errs[idx] = store.ApplyGateWrite(ctx, workmgmt.GateWrite{
				Work: cur, ExpectedStatus: workmgmt.StatusReadyForTLVerify,
				Transition: &workmgmt.WorkTransitionHistory{
					WorkItemID: id, FromStatus: workmgmt.StatusReadyForTLVerify,
					ToStatus: workmgmt.StatusReadyForCAVerify,
					Action:   workmgmt.ActionVerifyTL, ActorID: cur.UpdatedBy, Remarks: "parallel",
				},
			})
		}(i)
	}
	ready.Wait()
	close(start)
	wg.Wait()
	assertOneSuccessOneConflict(t, errs[0], errs[1], true)
}

func assertConcurrentVerifyTL(t *testing.T, store workmgmt.Store, clientID, companyID string) {
	t.Helper()
	ctx := context.Background()
	clientID, companyID = seedRefs(clientID, companyID)
	svc := workmgmt.NewService(store)
	mgr := actor("MGR", workmgmt.RoleManager)
	tl1 := actor("TL-A", workmgmt.RoleTeamLeader)
	tl2 := actor("TL-B", workmgmt.RoleTeamLeader)

	w, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
		Title: "BUG-0013 concurrent VerifyTL", AssignedTo: "EMP", AssignedToName: "Emp",
		ClientID: clientID, CompanyID: companyID, WorkType: "GSTR-3B",
		PeriodKey: "BUG13V-" + uniqueSuffix(),
		RiskClass: workmgmt.RiskMedium, OwnerCAID: "CA", TlID: "TL-A", AssigneeID: "EMP",
		Status: workmgmt.StatusInProgress,
	}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatalf("CreateWork: %v", err)
	}
	t.Cleanup(func() { _ = store.SoftDeleteWork(ctx, w.ID, "BUG13") })

	got, err := store.GetWork(ctx, w.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	got.Status = workmgmt.StatusReadyForTLVerify
	if err := store.UpdateWork(ctx, got); err != nil {
		t.Fatalf("UpdateWork: %v", err)
	}

	var ready sync.WaitGroup
	ready.Add(2)
	start := make(chan struct{})
	errs := make([]error, 2)
	actors := []workmgmt.Actor{tl1, tl2}
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			ready.Done()
			<-start
			_, errs[idx] = svc.VerifyTL(ctx, actors[idx], w.ID, "pass", fmt.Sprintf("parallel-%d", idx))
		}(i)
	}
	ready.Wait()
	close(start)
	wg.Wait()
	assertOneSuccessOneConflict(t, errs[0], errs[1], false)

	final, err := store.GetWork(ctx, w.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	if final.Status != workmgmt.StatusReadyForCAVerify {
		t.Fatalf("final status want READY_FOR_CA_VERIFY got %s", final.Status)
	}
}

func assertConcurrentClose(t *testing.T, store workmgmt.Store, clientID, companyID string) {
	t.Helper()
	ctx := context.Background()
	clientID, companyID = seedRefs(clientID, companyID)
	svc := workmgmt.NewService(store)
	mgr1 := actor("MGR-A", workmgmt.RoleManager)
	mgr2 := actor("MGR-B", workmgmt.RoleManager)

	w, err := svc.CreateWork(ctx, mgr1, &workmgmt.WorkItem{
		Title: "BUG-0013 concurrent Close", AssignedTo: "EMP", AssignedToName: "Emp",
		ClientID: clientID, CompanyID: companyID, WorkType: "GSTR-3B",
		PeriodKey: "BUG13C-" + uniqueSuffix(),
		RiskClass: workmgmt.RiskMedium, OwnerCAID: "CA", TlID: "TL", AssigneeID: "EMP",
		Status: workmgmt.StatusInProgress,
	}, workmgmt.RoleEmployee)
	if err != nil {
		t.Fatalf("CreateWork: %v", err)
	}
	t.Cleanup(func() { _ = store.SoftDeleteWork(ctx, w.ID, "BUG13") })

	got, err := store.GetWork(ctx, w.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	got.Status = workmgmt.StatusReadyForManagerClose
	if err := store.UpdateWork(ctx, got); err != nil {
		t.Fatalf("UpdateWork: %v", err)
	}

	var ready sync.WaitGroup
	ready.Add(2)
	start := make(chan struct{})
	errs := make([]error, 2)
	actors := []workmgmt.Actor{mgr1, mgr2}
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			ready.Done()
			<-start
			_, errs[idx] = svc.CloseWork(ctx, actors[idx], w.ID, fmt.Sprintf("parallel-close-%d", idx))
		}(i)
	}
	ready.Wait()
	close(start)
	wg.Wait()
	assertOneSuccessOneConflict(t, errs[0], errs[1], false)

	final, err := store.GetWork(ctx, w.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	if final.Status != workmgmt.StatusClosed {
		t.Fatalf("final status want CLOSED got %s", final.Status)
	}
}

func assertOneSuccessOneConflict(t *testing.T, a, b error, rawErrStatusConflict bool) {
	t.Helper()
	ok, conflict := 0, 0
	for _, err := range []error{a, b} {
		if err == nil {
			ok++
			continue
		}
		if isGateConflict(err, rawErrStatusConflict) {
			conflict++
			continue
		}
		t.Fatalf("unexpected error: %v", err)
	}
	if ok != 1 || conflict != 1 {
		t.Fatalf("want 1 success + 1 conflict, got success=%d conflict=%d (errA=%v errB=%v)", ok, conflict, a, b)
	}
}

func isGateConflict(err error, rawErrStatusConflict bool) bool {
	if rawErrStatusConflict && errors.Is(err, workmgmt.ErrStatusConflict) {
		return true
	}
	var ae *apperrors.AppError
	if errors.As(err, &ae) && ae.Code == apperrors.CodeConflict && ae.HTTPStatus == 409 {
		return true
	}
	return errors.Is(err, workmgmt.ErrStatusConflict)
}

func uniqueSuffix() string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), bug13Seq.Add(1))
}

// seedRefs fills MemoryStore-friendly IDs when Postgres refs were not supplied.
func seedRefs(clientID, companyID string) (string, string) {
	if clientID == "" {
		clientID = "CL-BUG13"
	}
	if companyID == "" {
		companyID = "CO-BUG13"
	}
	return clientID, companyID
}

// openOptionalPostgres connects when DATABASE_URL is set, or when the local
// SmartCA DSN answers. Returns nil when Postgres / wm tables are unavailable.
func openOptionalPostgres(t *testing.T) (*sql.DB, string, string) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://smartca:yourpassword@localhost:5432/smartca?sslmode=disable"
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Logf("postgres open skipped: %v", err)
		return nil, "", ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		t.Logf("postgres ping skipped: %v", err)
		return nil, "", ""
	}
	var n int
	if err := db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM information_schema.tables
		WHERE table_schema='public' AND table_name='wm_work_items'`).Scan(&n); err != nil || n == 0 {
		_ = db.Close()
		t.Logf("postgres wm_work_items missing; skipping PG subtests")
		return nil, "", ""
	}
	var clientID, companyID string
	_ = db.QueryRowContext(ctx, `SELECT id FROM clients WHERE deleted_at IS NULL LIMIT 1`).Scan(&clientID)
	if clientID == "" {
		_ = db.QueryRowContext(ctx, `SELECT id FROM clients LIMIT 1`).Scan(&clientID)
	}
	_ = db.QueryRowContext(ctx, `SELECT id FROM companies WHERE deleted_at IS NULL LIMIT 1`).Scan(&companyID)
	if companyID == "" {
		_ = db.QueryRowContext(ctx, `SELECT id FROM companies LIMIT 1`).Scan(&companyID)
	}
	if clientID == "" || companyID == "" {
		_ = db.Close()
		t.Logf("postgres missing clients/companies seed; skipping PG subtests")
		return nil, "", ""
	}
	t.Logf("postgres concurrent gate subtests enabled (client=%s company=%s)", clientID, companyID)
	return db, clientID, companyID
}
