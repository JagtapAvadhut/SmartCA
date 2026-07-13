package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"log/slog"

	"github.com/JagtapAvadhut/smartca-backend/internal/api/handlers"
	"github.com/JagtapAvadhut/smartca-backend/internal/api/routes"
	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
	"github.com/JagtapAvadhut/smartca-backend/internal/seed"
)

func setupTestServer(t *testing.T) http.Handler {
	t.Helper()
	data, err := seed.LoadSeed()
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	store := memory.NewStore()
	store.Reset(data)
	if err := seed.ValidateIntegrity(store); err != nil {
		t.Fatalf("integrity: %v", err)
	}

	cfg := config.Config{
		AppEnv:           "test",
		HTTPHost:         "127.0.0.1",
		HTTPPort:         8080,
		FrontendOrigin:   "http://localhost:5173,http://127.0.0.1:5173",
		FrontendOrigins:  []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		LogLevel:         "error",
		SessionTTL:       30 * time.Minute,
		DemoResetEnabled: true,
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	authSvc := services.NewAuthService(store, cfg)
	archiveSvc := services.NewArchiveService(store)
	archiveSvc.SetSnapshot(data)

	deps := routes.Deps{
		Cfg: cfg, Log: log, Store: store, Auth: authSvc, Archive: archiveSvc,
		Health:       &handlers.HealthHandler{Store: store},
		AuthH:        &handlers.AuthHandler{Auth: authSvc, Archive: archiveSvc, Cfg: cfg},
		Clients:      &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColClients), AllowDuplicate: true},
		Companies:    &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColCompanies)},
		Employees:    &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColEmployees)},
		Documents:    &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColDocuments)},
		Tasks:        &handlers.CRUDHandler{Svc: services.NewCRUDService(store, services.ColTasks)},
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
		Invoices:     &handlers.InvoiceHandler{Svc: services.NewInvoiceService(store)},
		Payments:     &handlers.PaymentHandler{Svc: services.NewPaymentService(store)},
		Dashboard:    &handlers.DashboardHandler{Svc: services.NewDashboardService(store)},
		Reports:      &handlers.ReportHandler{Svc: services.NewReportService(store)},
		Search:       &handlers.SearchHandler{Svc: services.NewSearchService(store)},
		Accounting:   &handlers.AccountingHandler{Svc: services.NewAccountingService(store)},
		ArchiveH:     &handlers.ArchiveHandler{Svc: archiveSvc},
		Settings:     &handlers.SettingsHandler{Svc: services.NewSettingsService(store)},
		LoginHistory: &handlers.LoginHistoryHandler{Store: store},
		NotifsExtra:  &handlers.NotificationExtraHandler{Store: store},
	}
	return routes.NewRouter(deps)
}

func TestLoginClientsUnauthorized(t *testing.T) {
	router := setupTestServer(t)

	t.Run("unauthorized clients", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/clients", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
		}
		var body map[string]any
		_ = json.Unmarshal(rr.Body.Bytes(), &body)
		if body["success"] != false {
			t.Fatalf("expected success=false: %v", body)
		}
	})

	t.Run("login and list clients", func(t *testing.T) {
		payload, _ := json.Marshal(map[string]any{
			"identifier": "rajesh.sharma@smartca.in",
			"password":   "SmartCA@2025",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("login status=%d body=%s", rr.Code, rr.Body.String())
		}
		var loginResp struct {
			Success bool `json:"success"`
			Data    struct {
				Token string         `json:"token"`
				User  map[string]any `json:"user"`
			} `json:"data"`
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &loginResp); err != nil {
			t.Fatal(err)
		}
		if !loginResp.Success || loginResp.Data.Token == "" {
			t.Fatalf("bad login response: %s", rr.Body.String())
		}
		if _, ok := loginResp.Data.User["passwordHash"]; ok {
			t.Fatal("passwordHash must not be returned")
		}

		req2 := httptest.NewRequest(http.MethodGet, "/api/v1/clients?page=1&pageSize=10", nil)
		req2.Header.Set("Authorization", "Bearer "+loginResp.Data.Token)
		rr2 := httptest.NewRecorder()
		router.ServeHTTP(rr2, req2)
		if rr2.Code != http.StatusOK {
			t.Fatalf("clients status=%d body=%s", rr2.Code, rr2.Body.String())
		}
		var listResp struct {
			Success bool  `json:"success"`
			Data    []any `json:"data"`
			Meta    struct {
				Pagination *struct {
					TotalItems int `json:"totalItems"`
				} `json:"pagination"`
			} `json:"meta"`
		}
		if err := json.Unmarshal(rr2.Body.Bytes(), &listResp); err != nil {
			t.Fatal(err)
		}
		if !listResp.Success || len(listResp.Data) == 0 {
			t.Fatalf("expected clients: %s", rr2.Body.String())
		}
	})
}

func TestHealthLive(t *testing.T) {
	router := setupTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d", rr.Code)
	}
}
