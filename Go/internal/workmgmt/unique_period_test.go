package workmgmt_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
	"github.com/lib/pq"
)

// periodUniqueStore simulates Postgres unique violations on period indexes.
type periodUniqueStore struct {
	*workmgmt.MemoryStore
	constraint string
}

func (s *periodUniqueStore) CreateWork(ctx context.Context, w *workmgmt.WorkItem) error {
	return &pq.Error{Code: "23505", Constraint: s.constraint}
}

func TestCreateWork_DuplicatePeriod_Conflict(t *testing.T) {
	cases := []struct {
		name       string
		constraint string
		wantSubstr string
	}{
		{"company period", "uq_wm_work_company_period", "company"},
		{"client period", "uq_wm_work_client_period", "client"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			svc := workmgmt.NewService(&periodUniqueStore{
				MemoryStore: workmgmt.NewMemoryStore(),
				constraint:  tc.constraint,
			})
			mgr := actor("MGR", workmgmt.RoleManager)

			_, err := svc.CreateWork(ctx, mgr, &workmgmt.WorkItem{
				Title:      "GSTR-1 Jan",
				WorkType:   "GSTR1",
				ClientID:   "CLT-0001",
				CompanyID:  "CMP-0001",
				PeriodKey:  "2099-01",
				AssignedTo: "EMP-1",
			}, workmgmt.RoleEmployee)
			if err == nil {
				t.Fatal("expected conflict, got nil")
			}
			var ae *apperrors.AppError
			if !errors.As(err, &ae) {
				t.Fatalf("expected AppError, got %T: %v", err, err)
			}
			if ae.Code != apperrors.CodeConflict || ae.HTTPStatus != 409 {
				t.Fatalf("want CONFLICT/409, got code=%s status=%d msg=%s", ae.Code, ae.HTTPStatus, ae.Message)
			}
			if !strings.Contains(strings.ToLower(ae.Message), tc.wantSubstr) {
				t.Fatalf("message %q should mention %q", ae.Message, tc.wantSubstr)
			}
		})
	}
}
