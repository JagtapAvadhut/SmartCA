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
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

// Deps aggregates handlers and services for route wiring.
type Deps struct {
	Cfg     config.Config
	Log     *slog.Logger
	Store   repository.Store
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
	AI           *handlers.AIHandler
	Work         *handlers.WorkHandler
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
	r.Get("/openapi.yaml", handlers.OpenAPIYAML)
	r.Get("/docs", handlers.SwaggerUI)
	r.Get("/docs/", handlers.SwaggerUI)

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

			if d.AI != nil {
				pr.Route("/ai", func(ar chi.Router) {
					ar.Use(middleware.RequirePermission(rbac.AIView))
					ar.Post("/chat", d.AI.Chat)
					ar.Post("/chat/stream", d.AI.ChatStream)
					ar.Get("/settings", d.AI.GetSettings)
					ar.Put("/settings", d.AI.SaveSettings)
					ar.Delete("/settings", d.AI.RemoveSettings)
					ar.Post("/settings/test", d.AI.TestSettings)
					ar.Post("/summarize", d.AI.Summarize)
					ar.Post("/email", d.AI.Email)
					ar.Post("/client-summary", d.AI.ClientSummary)
					ar.Post("/document-analysis", d.AI.DocumentAnalysis)
					ar.Post("/dashboard-insights", d.AI.DashboardInsights)
				})
			}

			if d.Work != nil {
				mountWork(pr, d.Work)
			}
		})
	})

	return r
}

func mountWork(r chi.Router, h *handlers.WorkHandler) {
	r.Route("/work", func(wr chi.Router) {
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items", h.List)
		wr.With(middleware.RequireWorkPermission(rbac.WorkCreate)).Post("/items", h.Create)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}", h.Get)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Patch("/items/{id}", h.Update)
		wr.With(middleware.RequireWorkPermission(rbac.WorkAssign)).Post("/items/{id}/reassign", h.Reassign)
		wr.With(middleware.RequireWorkPermission(rbac.WorkAssign)).Post("/items/{id}/transfer", h.Transfer)
		wr.With(middleware.RequireWorkPermission(rbac.WorkAssign)).Post("/items/{id}/assign", h.AssignSlot)
		wr.With(middleware.RequireWorkPermission(rbac.WorkTransition)).Post("/items/{id}/transitions", h.Transition)
		wr.With(middleware.RequireWorkPermission(rbac.WorkVerifyTL)).Post("/items/{id}/verify/tl", h.VerifyTL)
		wr.With(middleware.RequireWorkPermission(rbac.WorkVerifyCA)).Post("/items/{id}/verify/ca", h.VerifyCA)
		wr.With(middleware.RequireWorkPermission(rbac.WorkCloseManager)).Post("/items/{id}/close", h.Close)
		wr.With(middleware.RequireWorkPermission(rbac.WorkReopen)).Post("/items/{id}/reopen", h.Reopen)
		wr.With(middleware.RequireWorkPermission(rbac.WorkDelete)).Post("/items/{id}/archive", h.Archive)
		wr.With(middleware.RequireWorkPermission(rbac.WorkDelete)).Post("/items/{id}/restore", h.Restore)
		wr.Delete("/items/{id}", h.PermanentDelete)

		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}/checklist", h.ListChecklist)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/items/{id}/checklist", h.AddChecklist)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Post("/items/{id}/checklist/{cid}/verify", h.VerifyChecklist)

		wr.With(middleware.RequireWorkPermission(rbac.IntakeCreate)).Post("/intakes", h.CreateIntake)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/intakes", h.ListIntakes)
		wr.With(middleware.RequireWorkPermission(rbac.IntakeApprove)).Post("/intakes/{id}/approve", h.ApproveIntake)
		wr.With(middleware.RequireWorkPermission(rbac.IntakeReject)).Post("/intakes/{id}/reject", h.RejectIntake)

		wr.With(middleware.RequireWorkPermission(rbac.EngagementCreate)).Post("/engagements", h.CreateEngagement)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/engagements", h.ListEngagements)

		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}/followups", h.ListFollowUps)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/items/{id}/followups", h.AddFollowUp)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Patch("/items/{id}/followups/{childId}", h.UpdateFollowUp)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/followups/{childId}/archive", h.ArchiveFollowUp)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/followups/{childId}/restore", h.RestoreFollowUp)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}/calls", h.ListCalls)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/items/{id}/calls", h.AddCall)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/calls/{childId}/archive", h.ArchiveCall)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/calls/{childId}/restore", h.RestoreCall)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}/emails", h.ListEmails)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/items/{id}/emails", h.AddEmail)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/emails/{childId}/archive", h.ArchiveEmail)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/emails/{childId}/restore", h.RestoreEmail)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}/meetings", h.ListMeetings)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/items/{id}/meetings", h.AddMeeting)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/meetings/{childId}/archive", h.ArchiveMeeting)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/meetings/{childId}/restore", h.RestoreMeeting)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/items/{id}/meetings/{childId}/cancel", h.CancelMeeting)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}/notes", h.ListNotes)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/items/{id}/notes", h.AddNote)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Patch("/items/{id}/notes/{childId}", h.UpdateNote)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/notes/{childId}/archive", h.ArchiveNote)
		wr.With(middleware.RequireWorkPermission(rbac.WorkEdit)).Post("/notes/{childId}/restore", h.RestoreNote)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}/comments", h.ListComments)
		wr.With(middleware.RequireWorkPermission(rbac.WorkComment)).Post("/items/{id}/comments", h.AddComment)
		wr.With(middleware.RequireWorkPermission(rbac.WorkComment)).Post("/comments/{childId}/archive", h.ArchiveComment)
		wr.With(middleware.RequireWorkPermission(rbac.WorkComment)).Post("/comments/{childId}/restore", h.RestoreComment)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}/attachments", h.ListAttachments)
		wr.With(middleware.RequireWorkPermission(rbac.WorkUpload)).Post("/items/{id}/attachments", h.AddAttachment)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/items/{id}/activity", h.ListActivity)
		wr.With(middleware.RequireWorkPermission(rbac.WorkAuditView)).Get("/items/{id}/audit", h.ListAudit)

		wr.With(middleware.RequireWorkPermission(rbac.WorkUpload)).Post("/attachments/{attachmentId}/archive", h.SoftDeleteAttachment)
		wr.With(middleware.RequireWorkPermission(rbac.WorkUpload)).Post("/attachments/{attachmentId}/restore", h.RestoreAttachment)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/attachments/{attachmentId}/download", h.DownloadAttachment)

		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/dashboard", h.Dashboard)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/search", h.Search)
		wr.With(middleware.RequireWorkPermission(rbac.WorkView)).Get("/timeline", h.Timeline)
		wr.With(middleware.RequireWorkPermission(rbac.WorkUsersCreate)).Post("/team/users", h.CreateTeamUser)
	})
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
		cr.With(middleware.RequirePermission(rbac.InvoicesEdit)).Post("/repair-financials", h.RepairFinancials)
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
