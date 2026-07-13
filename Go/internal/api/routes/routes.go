package routes

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/JagtapAvadhut/smartca-backend/internal/api/handlers"
	"github.com/JagtapAvadhut/smartca-backend/internal/api/middleware"
	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	"github.com/JagtapAvadhut/smartca-backend/internal/rbac"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

// Deps aggregates handlers and services for route wiring.
type Deps struct {
	Cfg     config.Config
	Log     *slog.Logger
	Store   *memory.Store
	Auth    *services.AuthService
	Archive *services.ArchiveService

	Health       *handlers.HealthHandler
	AuthH        *handlers.AuthHandler
	Clients      *handlers.CRUDHandler
	Companies    *handlers.CRUDHandler
	Employees    *handlers.CRUDHandler
	Documents    *handlers.CRUDHandler
	Tasks        *handlers.CRUDHandler
	Compliance   *handlers.CRUDHandler
	GST          *handlers.CRUDHandler
	ITR          *handlers.CRUDHandler
	TDS          *handlers.CRUDHandler
	ROC          *handlers.CRUDHandler
	Notes        *handlers.CRUDHandler
	Notifs       *handlers.CRUDHandler
	Calendar     *handlers.CRUDHandler
	Activities   *handlers.CRUDHandler
	AuditLogs    *handlers.CRUDHandler
	Users        *handlers.CRUDHandler
	Roles        *handlers.CRUDHandler
	Perms        *handlers.CRUDHandler
	Chat         *handlers.CRUDHandler
	Invoices     *handlers.InvoiceHandler
	Payments     *handlers.PaymentHandler
	Dashboard    *handlers.DashboardHandler
	Reports      *handlers.ReportHandler
	Search       *handlers.SearchHandler
	Accounting   *handlers.AccountingHandler
	ArchiveH     *handlers.ArchiveHandler
	Settings     *handlers.SettingsHandler
	LoginHistory *handlers.LoginHistoryHandler
	NotifsExtra  *handlers.NotificationExtraHandler
}

// NewRouter builds the chi router with /api/v1 routes.
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Recover(d.Log))
	r.Use(middleware.Logger(d.Log))
	r.Use(middleware.CORS(strings.Join(d.Cfg.FrontendOrigins, ",")))
	r.Use(middleware.MaxBytes(1 << 20))

	r.Get("/health/live", d.Health.Live)
	r.Get("/health/ready", d.Health.Ready)
	// Keep /version for ops probes; canonical contract is /api/v1/version.
	r.Get("/version", d.Health.Version)

	r.Route("/api/v1", func(api chi.Router) {
		api.Get("/version", d.Health.Version)
		api.Post("/auth/login", d.AuthH.Login)
		api.Post("/auth/forgot-password", d.AuthH.ForgotPassword)
		api.Post("/auth/reset-password", d.AuthH.ResetPassword)

		api.Group(func(pr chi.Router) {
			pr.Use(middleware.Auth(d.Store, d.Auth))

			pr.Post("/auth/logout", d.AuthH.Logout)
			pr.Get("/auth/me", d.AuthH.Me)
			pr.Post("/auth/change-password", d.AuthH.ChangePassword)
			pr.Post("/demo/reset", d.AuthH.DemoReset)

			mountCRUD(pr, "/clients", d.Clients, rbac.ClientsView, rbac.ClientsCreate, rbac.ClientsEdit, rbac.ClientsDelete, true)
			mountCRUD(pr, "/companies", d.Companies, rbac.CompaniesView, rbac.CompaniesCreate, rbac.CompaniesEdit, rbac.CompaniesEdit, true)
			mountCRUD(pr, "/employees", d.Employees, rbac.EmployeesView, rbac.EmployeesCreate, rbac.EmployeesEdit, rbac.EmployeesEdit, true)
			mountCRUD(pr, "/documents", d.Documents, rbac.DocumentsView, rbac.DocumentsUpload, rbac.DocumentsUpload, rbac.DocumentsDelete, true)
			mountCRUD(pr, "/tasks", d.Tasks, rbac.TasksView, rbac.TasksCreate, rbac.TasksEdit, rbac.TasksDelete, true)
			mountCRUD(pr, "/compliance", d.Compliance, rbac.ComplianceView, rbac.ComplianceCreate, rbac.ComplianceEdit, rbac.ComplianceDelete, false)
			mountCRUD(pr, "/gst", d.GST, rbac.GSTView, rbac.GSTView, rbac.GSTView, rbac.GSTView, false)
			mountCRUD(pr, "/itr", d.ITR, rbac.ITRView, rbac.ITRView, rbac.ITRView, rbac.ITRView, false)
			mountCRUD(pr, "/tds", d.TDS, rbac.TDSView, rbac.TDSView, rbac.TDSView, rbac.TDSView, false)
			mountCRUD(pr, "/roc", d.ROC, rbac.ROCView, rbac.ROCView, rbac.ROCView, rbac.ROCView, false)
			mountCRUD(pr, "/notes", d.Notes, rbac.DashboardView, rbac.DashboardView, rbac.DashboardView, rbac.DashboardView, false)
			mountCRUD(pr, "/notifications", d.Notifs, rbac.DashboardView, rbac.DashboardView, rbac.DashboardView, rbac.DashboardView, false)
			mountCRUD(pr, "/calendar-events", d.Calendar, rbac.DashboardView, rbac.DashboardView, rbac.DashboardView, rbac.DashboardView, false)
			mountCRUD(pr, "/activities", d.Activities, rbac.DashboardView, rbac.DashboardView, rbac.DashboardView, rbac.DashboardView, false)
			mountCRUD(pr, "/audit-logs", d.AuditLogs, rbac.SettingsView, rbac.SettingsView, rbac.SettingsView, rbac.SettingsView, false)
			mountCRUD(pr, "/users", d.Users, rbac.SettingsUsers, rbac.SettingsUsers, rbac.SettingsUsers, rbac.SettingsUsers, false)
			mountCRUD(pr, "/roles", d.Roles, rbac.SettingsRoles, rbac.SettingsRoles, rbac.SettingsRoles, rbac.SettingsRoles, false)
			mountCRUD(pr, "/permissions", d.Perms, rbac.SettingsRoles, rbac.SettingsRoles, rbac.SettingsRoles, rbac.SettingsRoles, false)
			mountCRUD(pr, "/chat", d.Chat, rbac.AIView, rbac.AIView, rbac.AIView, rbac.AIView, false)

			mountInvoices(pr, d.Invoices)
			mountPayments(pr, d.Payments)

			pr.With(middleware.RequirePermission(rbac.DashboardView)).Get("/dashboard", d.Dashboard.Get)
			pr.With(middleware.RequirePermission(rbac.ReportsView)).Get("/reports/summary", d.Reports.Summary)
			pr.With(middleware.RequirePermission(rbac.DashboardView)).Get("/search", d.Search.Search)
			pr.With(middleware.RequirePermission(rbac.SettingsUsers)).Get("/login-history", d.LoginHistory.List)
			pr.With(middleware.RequirePermission(rbac.DashboardView)).Post("/notifications/mark-all-read", d.NotifsExtra.MarkAllRead)

			pr.Route("/accounting", func(ac chi.Router) {
				ac.Use(middleware.RequirePermission(rbac.AccountingView))
				ac.Get("/journals", d.Accounting.Journals)
				ac.Post("/journals", d.Accounting.PostJournal)
				ac.Get("/statements", d.Accounting.Statements)
			})

			pr.Route("/archive", func(ar chi.Router) {
				ar.Use(middleware.RequirePermission(rbac.SettingsView))
				ar.Get("/", d.ArchiveH.List)
				ar.Post("/restore", d.ArchiveH.Restore)
				ar.Post("/permanent", d.ArchiveH.Permanent)
				ar.Post("/bulk-restore", d.ArchiveH.BulkRestore)
				ar.Post("/bulk-permanent", d.ArchiveH.BulkPermanent)
			})

			pr.Route("/settings", func(st chi.Router) {
				st.With(middleware.RequirePermission(rbac.SettingsView)).Get("/", d.Settings.Get)
				st.With(middleware.RequirePermission(rbac.SettingsEdit)).Patch("/", d.Settings.Update)
				st.With(middleware.RequirePermission(rbac.SettingsView)).Get("/organization", d.Settings.GetOrganization)
				st.With(middleware.RequirePermission(rbac.SettingsEdit)).Patch("/organization", d.Settings.UpdateOrganization)
			})
		})
	})

	return r
}

func mountCRUD(r chi.Router, path string, h *handlers.CRUDHandler, view, create, edit, del string, dup bool) {
	r.Route(path, func(cr chi.Router) {
		cr.With(middleware.RequirePermission(view)).Get("/", h.List)
		cr.With(middleware.RequirePermission(view)).Get("/{id}", h.Get)
		cr.With(middleware.RequirePermission(create)).Post("/", h.Create)
		cr.With(middleware.RequirePermission(edit)).Patch("/{id}", h.Update)
		cr.With(middleware.RequirePermission(del)).Post("/{id}/archive", h.Archive)
		cr.With(middleware.RequirePermission(edit)).Post("/{id}/restore", h.Restore)
		cr.With(middleware.RequirePermission(del)).Delete("/{id}", h.PermanentDelete)
		if dup {
			cr.With(middleware.RequirePermission(create)).Post("/{id}/duplicate", h.Duplicate)
		}
	})
}

func mountInvoices(r chi.Router, h *handlers.InvoiceHandler) {
	r.Route("/invoices", func(cr chi.Router) {
		cr.With(middleware.RequirePermission(rbac.InvoicesView)).Get("/", h.List)
		cr.With(middleware.RequirePermission(rbac.InvoicesView)).Get("/{id}", h.Get)
		cr.With(middleware.RequirePermission(rbac.InvoicesCreate)).Post("/", h.Create)
		cr.With(middleware.RequirePermission(rbac.InvoicesEdit)).Patch("/{id}", h.Update)
		cr.With(middleware.RequirePermission(rbac.InvoicesDelete)).Post("/{id}/archive", h.Archive)
		cr.With(middleware.RequirePermission(rbac.InvoicesEdit)).Post("/{id}/restore", h.Restore)
		cr.With(middleware.RequirePermission(rbac.InvoicesDelete)).Delete("/{id}", h.PermanentDelete)
		cr.With(middleware.RequirePermission(rbac.InvoicesCreate)).Post("/{id}/duplicate", h.Duplicate)
	})
}

func mountPayments(r chi.Router, h *handlers.PaymentHandler) {
	r.Route("/payments", func(cr chi.Router) {
		cr.With(middleware.RequirePermission(rbac.PaymentsView)).Get("/", h.List)
		cr.With(middleware.RequirePermission(rbac.PaymentsView)).Get("/{id}", h.Get)
		cr.With(middleware.RequirePermission(rbac.PaymentsCreate)).Post("/", h.Create)
		cr.With(middleware.RequirePermission(rbac.PaymentsCreate)).Patch("/{id}", h.Update)
		cr.With(middleware.RequirePermission(rbac.PaymentsCreate)).Post("/{id}/archive", h.Archive)
		cr.With(middleware.RequirePermission(rbac.PaymentsCreate)).Post("/{id}/restore", h.Restore)
		cr.With(middleware.RequirePermission(rbac.PaymentsCreate)).Delete("/{id}", h.PermanentDelete)
	})
}
