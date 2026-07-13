package rbac

import (
	"strings"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
)

// Permission constants matching the Smart CA frontend.
const (
	DashboardView = "dashboard.view"

	ClientsView   = "clients.view"
	ClientsCreate = "clients.create"
	ClientsEdit   = "clients.edit"
	ClientsDelete = "clients.delete"

	CompaniesView   = "companies.view"
	CompaniesCreate = "companies.create"
	CompaniesEdit   = "companies.edit"

	ComplianceView   = "compliance.view"
	ComplianceCreate = "compliance.create"
	ComplianceEdit   = "compliance.edit"
	ComplianceDelete = "compliance.delete"

	GSTView = "gst.view"
	ITRView = "itr.view"
	TDSView = "tds.view"
	ROCView = "roc.view"

	AccountingView = "accounting.view"

	InvoicesView   = "invoices.view"
	InvoicesCreate = "invoices.create"
	InvoicesEdit   = "invoices.edit"
	InvoicesDelete = "invoices.delete"

	PaymentsView   = "payments.view"
	PaymentsCreate = "payments.create"

	DocumentsView   = "documents.view"
	DocumentsUpload = "documents.upload"
	DocumentsDelete = "documents.delete"

	TasksView   = "tasks.view"
	TasksCreate = "tasks.create"
	TasksEdit   = "tasks.edit"
	TasksDelete = "tasks.delete"

	ReportsView   = "reports.view"
	ReportsExport = "reports.export"

	EmployeesView   = "employees.view"
	EmployeesCreate = "employees.create"
	EmployeesEdit   = "employees.edit"

	AIView = "ai.view"

	SettingsView     = "settings.view"
	SettingsEdit     = "settings.edit"
	SettingsUsers    = "settings.users"
	SettingsRoles    = "settings.roles"
	SettingsSecurity = "settings.security"
	SettingsBranding = "settings.branding"
	SettingsAPI      = "settings.api"
)

// RoleSuperAdmin is required for demo reset.
const RoleSuperAdmin = "super_admin"

// HasPermission reports whether user.permissions contains perm.
func HasPermission(user models.Record, perm string) bool {
	if user == nil || perm == "" {
		return false
	}
	raw, ok := user["permissions"]
	if !ok || raw == nil {
		return false
	}
	switch list := raw.(type) {
	case []any:
		for _, item := range list {
			if s, ok := item.(string); ok && s == perm {
				return true
			}
		}
	case []string:
		for _, s := range list {
			if s == perm {
				return true
			}
		}
	}
	return false
}

// HasAnyPermission reports whether the user has at least one of the permissions.
func HasAnyPermission(user models.Record, perms ...string) bool {
	for _, p := range perms {
		if HasPermission(user, p) {
			return true
		}
	}
	return false
}

// HasRole reports whether user.role matches role (case-insensitive).
func HasRole(user models.Record, role string) bool {
	if user == nil {
		return false
	}
	return strings.EqualFold(user.GetString("role"), role)
}

// CanDemoReset requires super_admin role.
func CanDemoReset(user models.Record) bool {
	return HasRole(user, RoleSuperAdmin)
}
