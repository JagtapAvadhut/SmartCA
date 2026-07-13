package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func loginPayload(identifier, password string) []byte {
	b, _ := json.Marshal(map[string]any{
		"identifier": identifier,
		"password":   password,
		"rememberMe": false,
		"device":     "Test",
	})
	return b
}

func doLogin(t *testing.T, router http.Handler, identifier, password string) (status int, token string, body map[string]any) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginPayload(identifier, password)))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	var envelope map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &envelope)
	token = ""
	if data, ok := envelope["data"].(map[string]any); ok {
		if tok, ok := data["token"].(string); ok {
			token = tok
		}
		if user, ok := data["user"].(map[string]any); ok {
			if _, has := user["passwordHash"]; has {
				t.Fatal("passwordHash must not be returned")
			}
			if _, has := user["password"]; has {
				t.Fatal("password must not be returned")
			}
		}
	}
	return rr.Code, token, envelope
}

func TestAuthLoginVariants(t *testing.T) {
	router := setupTestServer(t)

	cases := []struct {
		name       string
		identifier string
		password   string
		wantStatus int
	}{
		{"email", "rajesh.sharma@smartca.in", "SmartCA@2025", http.StatusOK},
		{"email case", "Rajesh.Sharma@SmartCA.in", "SmartCA@2025", http.StatusOK},
		{"username", "rajesh.sharma", "SmartCA@2025", http.StatusOK},
		{"loginId", "rsharma01", "SmartCA@2025", http.StatusOK},
		{"partner email", "priya.patel@smartca.in", "SmartCA@2025", http.StatusOK},
		{"ca email", "amit.kumar@smartca.in", "SmartCA@2025", http.StatusOK},
		{"bad password", "rajesh.sharma@smartca.in", "wrong", http.StatusUnauthorized},
		{"unknown user", "nobody@smartca.in", "SmartCA@2025", http.StatusUnauthorized},
		{"empty password", "rajesh.sharma@smartca.in", "", http.StatusBadRequest},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, token, _ := doLogin(t, router, tc.identifier, tc.password)
			if status != tc.wantStatus {
				t.Fatalf("status=%d want=%d", status, tc.wantStatus)
			}
			if tc.wantStatus == http.StatusOK && token == "" {
				t.Fatal("expected token")
			}
			if tc.wantStatus != http.StatusOK && token != "" {
				t.Fatal("failed login must not return token")
			}
		})
	}
}

func TestAuthMeLogout(t *testing.T) {
	router := setupTestServer(t)
	status, token, _ := doLogin(t, router, "rajesh.sharma@smartca.in", "SmartCA@2025")
	if status != http.StatusOK || token == "" {
		t.Fatalf("login failed status=%d", status)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("me status=%d body=%s", rr.Code, rr.Body.String())
	}

	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	rr2 := httptest.NewRecorder()
	router.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Fatalf("logout status=%d", rr2.Code)
	}

	req3 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req3.Header.Set("Authorization", "Bearer "+token)
	rr3 := httptest.NewRecorder()
	router.ServeHTTP(rr3, req3)
	if rr3.Code != http.StatusUnauthorized {
		t.Fatalf("me after logout status=%d", rr3.Code)
	}
}

func TestCORSLoginFrom127(t *testing.T) {
	router := setupTestServer(t)

	opt := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	opt.Header.Set("Origin", "http://127.0.0.1:5173")
	opt.Header.Set("Access-Control-Request-Method", "POST")
	opt.Header.Set("Access-Control-Request-Headers", "content-type")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, opt)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("options status=%d", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://127.0.0.1:5173" {
		t.Fatalf("ACAO=%q", got)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginPayload("rajesh.sharma@smartca.in", "SmartCA@2025")))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://127.0.0.1:5173")
	rr2 := httptest.NewRecorder()
	router.ServeHTTP(rr2, req)
	if rr2.Code != http.StatusOK {
		t.Fatalf("login status=%d body=%s", rr2.Code, rr2.Body.String())
	}
	if got := rr2.Header().Get("Access-Control-Allow-Origin"); got != "http://127.0.0.1:5173" {
		t.Fatalf("ACAO=%q", got)
	}
}

func TestDemoCredentialsConsistency(t *testing.T) {
	router := setupTestServer(t)
	demos := []string{
		"rajesh.sharma@smartca.in",
		"priya.patel@smartca.in",
		"amit.kumar@smartca.in",
	}
	for _, email := range demos {
		status, token, _ := doLogin(t, router, email, "SmartCA@2025")
		if status != http.StatusOK || token == "" {
			t.Fatalf("demo credential login failed for %s status=%d", email, status)
		}
	}
}
