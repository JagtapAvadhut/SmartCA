package services_test

import (
	"testing"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
)

func TestLogin_MergesPracticeCorePermissions(t *testing.T) {
	mem := memory.NewStore()
	store := repository.AdaptMemory(mem)

	// Stale classic WM grants only — no Practice Core strings in stored JSON.
	staleMgr := []string{"work.view", "work.create", "work.edit", "work.delete", "work.assign", "dashboard.view"}
	staleEmp := []string{"work.view", "work.edit", "dashboard.view"}

	_, err := store.Create(services.ColUsers, models.Record{
		"id": "USR-MGR-BUG8", "email": "mgr.bug8@smartca.in", "fullName": "Bug8 Manager",
		"role": "manager", "status": "active", "password": "SmartCA@2025", "permissions": staleMgr,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.Create(services.ColUsers, models.Record{
		"id": "USR-EMP-BUG8", "email": "emp.bug8@smartca.in", "fullName": "Bug8 Employee",
		"role": "employee", "status": "active", "password": "SmartCA@2025", "permissions": staleEmp,
	})
	if err != nil {
		t.Fatal(err)
	}

	authSvc := services.NewAuthService(store, config.Config{SessionTTL: time.Hour})

	mgrRes, err := authSvc.Login("mgr.bug8@smartca.in", "SmartCA@2025", false, "Test", "127.0.0.1")
	if err != nil {
		t.Fatalf("manager login: %v", err)
	}
	empRes, err := authSvc.Login("emp.bug8@smartca.in", "SmartCA@2025", false, "Test", "127.0.0.1")
	if err != nil {
		t.Fatalf("employee login: %v", err)
	}

	mgrPerms := asStrings(mgrRes.User["permissions"])
	empPerms := asStrings(empRes.User["permissions"])

	for _, want := range []string{
		workmgmt.PermTransition, workmgmt.PermCloseManager, workmgmt.PermReopen,
		workmgmt.PermIntakeCreate, workmgmt.PermIntakeApprove, workmgmt.PermIntakeReject,
		workmgmt.PermHierarchyPlace, workmgmt.PermEngagementCreate,
	} {
		if !contains(mgrPerms, want) {
			t.Fatalf("manager login missing %s; perms=%v", want, mgrPerms)
		}
	}
	// SoD: Manager must not inherit TL/CA verify or partner-close via hierarchy merge.
	for _, forbid := range []string{workmgmt.PermVerifyTL, workmgmt.PermVerifyCA, workmgmt.PermClosePartner} {
		if contains(mgrPerms, forbid) {
			t.Fatalf("manager login must not include %s", forbid)
		}
	}

	for _, want := range []string{
		workmgmt.PermView, workmgmt.PermEdit, workmgmt.PermTransition,
		workmgmt.PermComment, workmgmt.PermUpload, workmgmt.PermDashboardMine,
	} {
		if !contains(empPerms, want) {
			t.Fatalf("employee login missing %s; perms=%v", want, empPerms)
		}
	}
	for _, forbid := range []string{
		workmgmt.PermAssign, workmgmt.PermCloseManager, workmgmt.PermIntakeApprove, workmgmt.PermVerifyTL,
	} {
		if contains(empPerms, forbid) {
			t.Fatalf("employee login must not include %s", forbid)
		}
	}

	// /auth/me path uses UserFromSession → same merge.
	me, err := authSvc.UserFromSession(repository.Session{UserID: "USR-MGR-BUG8", Active: true})
	if err != nil {
		t.Fatalf("UserFromSession: %v", err)
	}
	if !contains(asStrings(me["permissions"]), workmgmt.PermTransition) {
		t.Fatalf("me payload missing work.transition; perms=%v", me["permissions"])
	}
}

func asStrings(raw any) []string {
	switch v := raw.(type) {
	case []string:
		return v
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

func contains(list []string, want string) bool {
	for _, s := range list {
		if s == want {
			return true
		}
	}
	return false
}
