package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai"
	"github.com/JagtapAvadhut/smartca-backend/internal/api/handlers"
	"github.com/JagtapAvadhut/smartca-backend/internal/api/routes"
	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	"github.com/JagtapAvadhut/smartca-backend/internal/database"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/postgres"
	"github.com/JagtapAvadhut/smartca-backend/internal/seed"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		os.Exit(runHealthcheck())
	}

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	log := newLogger(cfg.LogLevel)
	slog.SetDefault(log)

	// Connect to PostgreSQL
	log.Info("connecting to database",
		"host", cfg.DBHost,
		"port", cfg.DBPort,
		"database", cfg.DBName,
	)

	db, err := database.Connect(
		cfg.DBConnectionString(),
		cfg.DBMaxOpenConns,
		cfg.DBMaxIdleConns,
		int(cfg.DBConnMaxLifetime.Minutes()),
	)
	if err != nil {
		log.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	log.Info("database connected successfully")

	// Run migrations
	migrationsDir := filepath.Join(".", "migrations")
	log.Info("running database migrations", "dir", migrationsDir)
	if err := database.Migrate(db, migrationsDir); err != nil {
		log.Error("migration failed", "err", err)
		os.Exit(1)
	}

	// Initialize PostgreSQL store
	store := postgres.NewStore(db)

	// Load seed data if database is empty
	var snapshot map[string][]models.Record
	if store.Count(services.ColUsers, false) == 0 {
		log.Info("loading seed data")
		data, err := seed.LoadSeed()
		if err != nil {
			log.Error("seed load failed", "err", err)
			os.Exit(1)
		}
		if err := store.Reset(data); err != nil {
			log.Error("seed reset failed", "err", err)
			os.Exit(1)
		}
		snapshot = data
		log.Info("seed data loaded",
			"clients", store.Count(services.ColClients, true),
			"invoices", store.Count(services.ColInvoices, true),
			"users", store.Count(services.ColUsers, true),
		)
		if store.Count(services.ColUsers, true) == 0 {
			log.Error("seed reset left zero users — check FK order / DB constraints")
			os.Exit(1)
		}
	} else {
		// Skip full-table Snapshot on warm start — DemoReset loads embedded seed when nil.
		snapshot = nil
	}

	if err := seed.ValidateIntegrity(store); err != nil {
		log.Warn("seed integrity check had issues", "err", err)
	}

	authSvc := services.NewAuthService(store, cfg)
	archiveSvc := services.NewArchiveService(store)
	archiveSvc.SetSnapshot(snapshot)

	invoiceSvc := services.NewInvoiceService(store)
	paymentSvc := services.NewPaymentService(store)

	aiProvider, err := ai.NewProviderFromConfig(cfg)
	if err != nil {
		log.Warn("AI provider unavailable; AI routes will error until GEMINI_API_KEY is set", "err", err)
		aiProvider, _ = ai.NewProviderFromConfig(config.Config{AIProvider: "mock"})
	} else {
		log.Info("AI provider ready", "provider", aiProvider.Name(), "model", cfg.GeminiModel)
	}
	aiSvc := ai.NewService(cfg, store, log, aiProvider)

	deps := routes.Deps{
		Cfg:          cfg,
		Log:          log,
		Store:        store,
		Auth:         authSvc,
		Archive:      archiveSvc,
		Health:       &handlers.HealthHandler{Store: store},
		AuthH:        &handlers.AuthHandler{Auth: authSvc, Archive: archiveSvc, Cfg: cfg},
		Clients:      &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColClients), AllowDuplicate: true},
		Companies:    &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColCompanies), AllowDuplicate: true},
		Employees:    &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColEmployees), AllowDuplicate: true},
		Documents:    &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColDocuments), AllowDuplicate: true},
		Tasks:        &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColTasks), AllowDuplicate: true},
		Compliance:   &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColCompliance)},
		GST:          &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColGST)},
		ITR:          &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColITR)},
		TDS:          &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColTDS)},
		ROC:          &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColROC)},
		Notes:        &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColNotes)},
		Notifs:       &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColNotifications)},
		Calendar:     &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColCalendar)},
		Activities:   &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColActivities)},
		AuditLogs:    &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColAuditLogs)},
		Users:        &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColUsers)},
		Roles:        &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColRoles)},
		Perms:        &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColPermissions)},
		Chat:         &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColChat)},
		Invoices:     &handlers.InvoiceHandler{Svc: invoiceSvc},
		Payments:     &handlers.PaymentHandler{Svc: paymentSvc},
		Dashboard:    &handlers.DashboardHandler{Svc: services.NewDashboardService(store)},
		Reports:      &handlers.ReportHandler{Svc: services.NewReportService(store)},
		Search:       &handlers.SearchHandler{Svc: services.NewSearchService(store)},
		Accounting:   &handlers.AccountingHandler{Svc: services.NewAccountingService(store)},
		ArchiveH:     &handlers.ArchiveHandler{Svc: archiveSvc},
		Settings:     &handlers.SettingsHandler{Svc: services.NewSettingsService(store)},
		LoginHistory: &handlers.LoginHistoryHandler{Store: store},
		NotifsExtra:  &handlers.NotificationExtraHandler{Store: store},
		AI:           &handlers.AIHandler{Svc: aiSvc},
	}

	srv := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           routes.NewRouter(deps),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Info("listening", "addr", cfg.Addr(), "env", cfg.AppEnv, "origin", cfg.FrontendOrigin)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Info("shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error("graceful shutdown failed", "err", err)
		os.Exit(1)
	}
	log.Info("bye")
}

// runHealthcheck probes the local liveness endpoint for container HEALTHCHECK.
// Uses HTTP_HOST/HTTP_PORT from the environment (same as the server process).
func runHealthcheck() int {
	cfg, err := config.Load()
	if err != nil {
		return 1
	}
	host := cfg.HTTPHost
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	url := fmt.Sprintf("http://%s:%d/health/live", host, cfg.HTTPPort)
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func newLogger(level string) *slog.Logger {
	var lv slog.Level
	switch strings.ToLower(level) {
	case "debug":
		lv = slog.LevelDebug
	case "warn", "warning":
		lv = slog.LevelWarn
	case "error":
		lv = slog.LevelError
	default:
		lv = slog.LevelInfo
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lv}))
}
