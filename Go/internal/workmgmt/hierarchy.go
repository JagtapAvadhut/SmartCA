package workmgmt

import (
	"fmt"
	"strings"
)

// Canonical practice hierarchy roles (Architecture §5.2).
const (
	RolePartner          = "partner"
	RoleManager          = "manager"
	RoleCA               = "ca"
	RoleSeniorCA         = "senior_ca"
	RoleJuniorCA         = "junior_ca"
	RoleTeamLeader       = "team_leader"
	RoleAccountant       = "accountant"
	RoleArticleAssistant = "article_assistant"
	RoleEmployee         = "employee"
	RoleHR               = "hr"
	RoleReception        = "reception"
	RoleAdmin            = "admin"
	RoleClient           = "client"
)

// Permission constants for work management APIs.
const (
	PermView            = "work.view"
	PermCreate          = "work.create"
	PermEdit            = "work.edit"
	PermDelete          = "work.delete"
	PermAssign          = "work.assign"
	PermTransition      = "work.transition"
	PermVerifyTL        = "work.verify.tl"
	PermVerifyCA        = "work.verify.ca"
	PermCloseManager    = "work.close.manager"
	PermClosePartner    = "work.close.partner"
	PermReopen          = "work.reopen"
	PermComment         = "work.comment"
	PermUpload          = "work.upload"
	PermUsersCreate     = "work.users.create"
	PermAuditView       = "work.audit.view"
	PermDashboardManage = "work.dashboard.manage"
	PermDashboardMine   = "work.dashboard.mine"
	PermIntakeCreate    = "intake.create"
	PermIntakeApprove   = "intake.approve"
	PermIntakeReject    = "intake.reject"
	PermHierarchyPlace  = "hierarchy.place"
	PermEngagementCreate = "engagement.create"
	PermEngagementEdit   = "engagement.edit"
	PermEmployeesCreate  = "employees.create"
)

// AllPermissions is the full set granted to Partner / Manager.
func AllPermissions() []string {
	return []string{
		PermView, PermCreate, PermEdit, PermDelete, PermAssign, PermTransition,
		PermVerifyTL, PermVerifyCA, PermCloseManager, PermClosePartner, PermReopen,
		PermComment, PermUpload, PermUsersCreate, PermAuditView,
		PermDashboardManage, PermDashboardMine,
		PermIntakeCreate, PermIntakeApprove, PermIntakeReject,
		PermHierarchyPlace, PermEngagementCreate, PermEngagementEdit,
	}
}

func hasPerm(list []string, want string) bool {
	for _, p := range list {
		if p == want {
			return true
		}
	}
	return false
}

// PermissionsForRole returns default WM permissions for a hierarchy role.
func PermissionsForRole(role string) []string {
	switch NormalizeHierarchyRole(role) {
	case RolePartner:
		return AllPermissions()
	case RoleManager:
		// Manager closes at end of chain; TL/CA verify and partner-flag close are SoD-separated.
		skip := map[string]bool{
			PermClosePartner: true,
			PermVerifyTL:     true,
			PermVerifyCA:     true,
		}
		out := make([]string, 0, len(AllPermissions())-len(skip))
		for _, p := range AllPermissions() {
			if skip[p] {
				continue
			}
			out = append(out, p)
		}
		return out
	case RoleCA, RoleSeniorCA:
		return []string{
			PermView, PermCreate, PermEdit, PermDelete, PermAssign, PermTransition,
			PermVerifyCA, PermComment, PermUpload, PermUsersCreate, PermAuditView,
			PermDashboardManage, PermDashboardMine,
			PermEngagementCreate, PermEngagementEdit, PermIntakeCreate,
		}
	case RoleTeamLeader:
		return []string{
			PermView, PermCreate, PermEdit, PermAssign, PermTransition,
			PermVerifyTL, PermComment, PermUpload, PermUsersCreate, PermDashboardMine,
		}
	case RoleJuniorCA, RoleAccountant, RoleArticleAssistant, RoleEmployee:
		return []string{
			PermView, PermEdit, PermTransition, PermComment, PermUpload, PermDashboardMine,
		}
	case RoleReception:
		return []string{
			PermView, PermIntakeCreate, PermComment, PermUpload, PermDashboardMine,
		}
	case RoleHR:
		return []string{PermEmployeesCreate, PermUsersCreate, PermDashboardMine}
	case RoleAdmin:
		return []string{PermView, PermAuditView, PermDashboardMine}
	case RoleClient:
		return []string{}
	default:
		return []string{PermView, PermComment, PermDashboardMine}
	}
}

// HierarchyRank returns numeric rank (higher = more authority).
func HierarchyRank(role string) int {
	switch NormalizeHierarchyRole(role) {
	case RolePartner:
		return 110
	case RoleManager:
		return 100
	case RoleCA:
		return 70
	case RoleSeniorCA:
		return 65
	case RoleTeamLeader:
		return 50
	case RoleJuniorCA:
		return 30
	case RoleAccountant:
		return 25
	case RoleArticleAssistant:
		return 22
	case RoleEmployee:
		return 20
	case RoleReception, RoleHR:
		return 10
	case RoleAdmin:
		return 5
	case RoleClient:
		return 0
	default:
		return 0
	}
}

// IsLeadership reports Partner or Manager.
func IsLeadership(role string) bool {
	r := NormalizeHierarchyRole(role)
	return r == RolePartner || r == RoleManager
}

// IsProfessional reports CA / Senior CA.
func IsProfessional(role string) bool {
	r := NormalizeHierarchyRole(role)
	return r == RoleCA || r == RoleSeniorCA
}

// IsExecutor reports delivery executor grades (no verify/close).
func IsExecutor(role string) bool {
	switch NormalizeHierarchyRole(role) {
	case RoleJuniorCA, RoleAccountant, RoleArticleAssistant, RoleEmployee:
		return true
	default:
		return false
	}
}

// IsSupportRole reports HR / Reception / Admin / Client (no client work assign).
func IsSupportRole(role string) bool {
	switch NormalizeHierarchyRole(role) {
	case RoleHR, RoleReception, RoleAdmin, RoleClient:
		return true
	default:
		return false
	}
}

// NormalizeHierarchyRole maps legacy / raw roles onto canonical practice codes.
// Architecture forbids Partner→Manager, Article/Junior→TL, HR/Reception→Employee+edit.
func NormalizeHierarchyRole(role string) string {
	r := strings.ToLower(strings.TrimSpace(role))
	r = strings.ReplaceAll(r, "-", "_")
	switch r {
	case RolePartner:
		return RolePartner
	case RoleManager, "super_admin":
		return RoleManager
	case RoleCA:
		return RoleCA
	case RoleSeniorCA:
		return RoleSeniorCA
	case RoleJuniorCA:
		return RoleJuniorCA
	case RoleTeamLeader, "teamleader":
		return RoleTeamLeader
	case RoleAccountant:
		return RoleAccountant
	case RoleArticleAssistant, "article":
		return RoleArticleAssistant
	case RoleEmployee, "auditor":
		return RoleEmployee
	case RoleHR:
		return RoleHR
	case RoleReception, "receptionist":
		return RoleReception
	case RoleAdmin:
		return RoleAdmin
	case RoleClient:
		return RoleClient
	case "":
		return RoleEmployee
	default:
		return RoleEmployee
	}
}

// CanCreateRole reports whether actor may create a user with targetRole.
func CanCreateRole(actorRole, targetRole string) bool {
	actor := NormalizeHierarchyRole(actorRole)
	target := NormalizeHierarchyRole(targetRole)
	switch actor {
	case RolePartner, RoleManager:
		switch target {
		case RolePartner, RoleManager, RoleCA, RoleSeniorCA, RoleJuniorCA,
			RoleTeamLeader, RoleAccountant, RoleArticleAssistant, RoleEmployee,
			RoleHR, RoleReception, RoleAdmin:
			return true
		default:
			return false
		}
	case RoleCA, RoleSeniorCA:
		return IsExecutor(target) || target == RoleTeamLeader || target == RoleJuniorCA || target == RoleAccountant || target == RoleArticleAssistant
	case RoleTeamLeader:
		return IsExecutor(target)
	case RoleHR:
		// HR creates people records only — not WM hierarchy placement roles with work power.
		return target == RoleEmployee || target == RoleArticleAssistant || target == RoleAccountant ||
			target == RoleJuniorCA || target == RoleReception || target == RoleHR
	default:
		return false
	}
}

// CanAssignTo reports whether actor may assign work to a user of assigneeRole.
func CanAssignTo(actorRole, assigneeRole string) bool {
	actor := NormalizeHierarchyRole(actorRole)
	if IsSupportRole(actor) || IsExecutor(actor) {
		return false
	}
	if IsLeadership(actor) {
		return true
	}
	if IsProfessional(actor) {
		// CA assigns TL and executors in portfolio.
		return HierarchyRank(assigneeRole) <= HierarchyRank(RoleTeamLeader)
	}
	if actor == RoleTeamLeader {
		return IsExecutor(assigneeRole) || NormalizeHierarchyRole(assigneeRole) == RoleJuniorCA
	}
	return false
}

// CanMonitor reports whether actor can see assignee's work (legacy helper).
func CanMonitor(actorRole, actorID, assigneeID, assigneeRole string) bool {
	if actorID != "" && actorID == assigneeID {
		return true
	}
	actor := NormalizeHierarchyRole(actorRole)
	switch {
	case IsLeadership(actor):
		return true
	case IsProfessional(actor), actor == RoleTeamLeader:
		return HierarchyRank(assigneeRole) <= HierarchyRank(actor)
	default:
		return false
	}
}

// AssertCreatableRole returns an error if actor cannot create targetRole.
func AssertCreatableRole(actorRole, targetRole string) error {
	if CanCreateRole(actorRole, targetRole) {
		return nil
	}
	return fmt.Errorf("role %q cannot create user with role %q", NormalizeHierarchyRole(actorRole), NormalizeHierarchyRole(targetRole))
}

// canViewWork enforces visibility using ownership triad + scope bands.
func canViewWork(actor Actor, w *WorkItem) bool {
	role := NormalizeHierarchyRole(actor.Hierarchy)
	if role == RoleHR {
		return false
	}
	if IsLeadership(role) {
		return true
	}
	assignee := firstNonEmptyStr(w.AssigneeID, w.AssignedTo)
	if assignee == actor.ID || w.AssignedBy == actor.ID || w.CreatedBy == actor.ID {
		return true
	}
	if w.OwnerCAID == actor.ID || w.TlID == actor.ID {
		return true
	}
	if inDownline(actor, assignee) || inDownline(actor, w.OwnerCAID) || inDownline(actor, w.TlID) {
		return true
	}
	if IsProfessional(role) {
		// Portfolio: owner CA match already handled; also downline assignees.
		return false
	}
	if role == RoleTeamLeader {
		return false
	}
	if role == RoleReception {
		return false // reception uses intake APIs, not compliance work rows
	}
	return false
}

func inDownline(actor Actor, userID string) bool {
	if userID == "" {
		return false
	}
	for _, id := range actor.DownlineIDs {
		if id == userID {
			return true
		}
	}
	return false
}

func firstNonEmptyStr(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// applyListScope mutates filters for role-aware list/search queries (Architecture §7.2).
func applyListScope(actor Actor, f *ListFilter) {
	role := NormalizeHierarchyRole(actor.Hierarchy)
	switch {
	case IsLeadership(role):
		// firm-wide
		return
	case role == RoleHR:
		f.ForceEmpty = true
		return
	case role == RoleReception:
		f.ForceEmpty = true // intake desk is separate
		return
	case IsProfessional(role):
		f.OwnerCAID = actor.ID
		f.ScopeDownlineIDs = append([]string{}, actor.DownlineIDs...)
		f.InvolvedUserID = ""
		f.AssigneeID = ""
		return
	case role == RoleTeamLeader:
		f.TlID = actor.ID
		f.ScopeDownlineIDs = append([]string{}, actor.DownlineIDs...)
		f.InvolvedUserID = ""
		return
	default:
		// Executors: assigned only
		f.AssigneeID = actor.ID
		f.InvolvedUserID = ""
	}
}
