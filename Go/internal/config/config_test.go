package config

import (
	"strings"
	"testing"
	"time"
)

func TestParseOrigins(t *testing.T) {
	got := ParseOrigins(" http://localhost:5173 , http://127.0.0.1:5173 ,http://localhost:5173 ")
	if len(got) != 2 {
		t.Fatalf("len=%d got=%v", len(got), got)
	}
	if got[0] != "http://localhost:5173" || got[1] != "http://127.0.0.1:5173" {
		t.Fatalf("got=%v", got)
	}
}

func TestOriginAllowed(t *testing.T) {
	cfg := Config{
		FrontendOrigins: []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		FrontendOrigin:  "http://localhost:5173,http://127.0.0.1:5173",
		HTTPPort:        8080,
		LogLevel:        "info",
		SessionTTL:      time.Minute,
	}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	if !cfg.OriginAllowed("http://127.0.0.1:5173") {
		t.Fatal("127.0.0.1 should be allowed")
	}
	if cfg.OriginAllowed("http://evil.example") {
		t.Fatal("evil origin must be rejected")
	}
	if cfg.OriginAllowed("") {
		t.Fatal("empty origin must be rejected")
	}
}

func TestValidateRejectsStar(t *testing.T) {
	cfg := Config{
		FrontendOrigins: []string{"*"},
		HTTPPort:        8080,
		LogLevel:        "info",
		SessionTTL:      time.Minute,
	}
	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "*") {
		t.Fatalf("expected * rejection, err=%v", err)
	}
}
