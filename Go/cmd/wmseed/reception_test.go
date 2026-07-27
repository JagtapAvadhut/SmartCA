package main

import (
	"fmt"
	"strings"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

func TestReceptionRoster_WMEmails(t *testing.T) {
	roster := receptionRoster("WM-MGR-0001")
	if len(roster) < 2 {
		t.Fatalf("want at least 2 receptionists, got %d", len(roster))
	}
	for i, u := range roster {
		wantEmail := fmt.Sprintf("reception%d@wm.smartca.in", i+1)
		wantID := fmt.Sprintf("WM-RCP-%04d", i+1)
		if u.ID != wantID {
			t.Fatalf("user %d id: want %s got %s", i+1, wantID, u.ID)
		}
		if u.Email != wantEmail {
			t.Fatalf("user %d email: want %s got %s", i+1, wantEmail, u.Email)
		}
		if !strings.HasSuffix(u.Email, "@wm.smartca.in") {
			t.Fatalf("bad email %q", u.Email)
		}
		if u.Role != "reception" {
			t.Fatalf("want role reception, got %q", u.Role)
		}
		if u.ReportsTo != "WM-MGR-0001" {
			t.Fatalf("want reportsTo WM-MGR-0001, got %q", u.ReportsTo)
		}
		perms := workmgmt.PermissionsForRole(u.Role)
		hasIntake := false
		for _, p := range perms {
			if p == workmgmt.PermIntakeCreate {
				hasIntake = true
			}
			if p == workmgmt.PermAssign || p == workmgmt.PermEdit {
				t.Fatalf("reception must not have %s", p)
			}
		}
		if !hasIntake {
			t.Fatal("reception must have intake.create")
		}
	}
}
