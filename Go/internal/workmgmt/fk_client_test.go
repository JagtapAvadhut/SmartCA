package workmgmt_test

import (
	"context"
	"errors"
	"testing"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
	"github.com/lib/pq"
)

// clientFKStore simulates Postgres FK violations on engagement/intake client_id.
type clientFKStore struct {
	*workmgmt.MemoryStore
}

func (s *clientFKStore) CreateEngagement(ctx context.Context, e *workmgmt.Engagement) error {
	return &pq.Error{Code: "23503", Constraint: "fk_wm_eng_client"}
}

func (s *clientFKStore) ApproveIntakeAtomic(ctx context.Context, eng *workmgmt.Engagement, in *workmgmt.Intake, expectedStatus string) error {
	return &pq.Error{Code: "23503", Constraint: "fk_wm_eng_client"}
}

func assertClientErrorNotInternal(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("expected client error, got nil")
	}
	var ae *apperrors.AppError
	if !errors.As(err, &ae) {
		t.Fatalf("expected AppError, got %T: %v", err, err)
	}
	if ae.Code == apperrors.CodeInternal || ae.HTTPStatus >= 500 {
		t.Fatalf("FK must not be Internal/5xx: code=%s status=%d msg=%s", ae.Code, ae.HTTPStatus, ae.Message)
	}
	if ae.HTTPStatus != 400 && ae.HTTPStatus != 404 && ae.HTTPStatus != 422 {
		t.Fatalf("want 400/404/422, got %d (%s)", ae.HTTPStatus, ae.Code)
	}
}

func TestCreateEngagement_InvalidClientID_NotInternal(t *testing.T) {
	ctx := context.Background()
	svc := workmgmt.NewService(&clientFKStore{MemoryStore: workmgmt.NewMemoryStore()})
	mgr := actor("MGR", workmgmt.RoleManager)

	_, err := svc.CreateEngagement(ctx, mgr, &workmgmt.Engagement{
		ClientID: "CLI-DOES-NOT-EXIST", Title: "Eng", Services: []string{"GST"}, OwnerCAID: "CA1",
	})
	assertClientErrorNotInternal(t, err)
}

func TestApproveIntake_InvalidClientID_NotInternal(t *testing.T) {
	ctx := context.Background()
	store := &clientFKStore{MemoryStore: workmgmt.NewMemoryStore()}
	svc := workmgmt.NewService(store)
	rec := actor("REC", workmgmt.RoleReception)
	mgr := actor("MGR", workmgmt.RoleManager)

	in, err := svc.CreateIntake(ctx, rec, &workmgmt.Intake{
		Source: "walk-in", ContactName: "ABC Pvt", Services: []string{"GST"},
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = svc.ApproveIntake(ctx, mgr, in.ID, "CLI-DOES-NOT-EXIST", "CO1", "CA1", "GST retainer", nil)
	assertClientErrorNotInternal(t, err)
}
