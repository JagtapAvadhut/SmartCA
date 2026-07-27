package main

// wmreceptionseed upserts WM reception users only (no wipe of 5k works).
// Usage (from Go/): go run ./cmd/wmreceptionseed
//
// Creates reception1@wm.smartca.in … receptionN@wm.smartca.in with role reception,
// PermissionsForRole, password SmartCA@2025 (same bcrypt as wmseed).

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/JagtapAvadhut/smartca-backend/internal/workmgmt"
	_ "github.com/lib/pq"
)

const nReception = 2

// Same bcrypt as wmseed / practiceuatseed for SmartCA@2025.
var passwordHash = "$2a$10$LfjRwo5HgMU/P2xEQMtaYu1PNHkOXL/ZrDAdhKG8Ob9j2XRw5i2la"

func main() {
	loadDotEnv(".env")
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		getenv("DB_HOST", "localhost"), getenv("DB_PORT", "5432"),
		getenv("DB_USER", "smartca"), os.Getenv("DB_PASSWORD"), getenv("DB_NAME", "smartca"))
	db, err := sql.Open("postgres", dsn)
	must(err)
	defer db.Close()
	must(db.Ping())

	mgr := resolveManagerID(db)
	log.Printf("upserting %d WM reception users (reportsTo=%q)…", nReception, mgr)
	emails := upsertReception(db, mgr)
	log.Println("wmreceptionseed complete")
	log.Println("logins (password SmartCA@2025):")
	for _, e := range emails {
		log.Printf("  %s", e)
	}
}

func resolveManagerID(db *sql.DB) string {
	var id string
	err := db.QueryRow(`SELECT id FROM users WHERE id LIKE 'WM-MGR-%' AND archived = false ORDER BY id LIMIT 1`).Scan(&id)
	if err != nil {
		log.Printf("no WM manager found (reportsTo empty): %v", err)
		return ""
	}
	return id
}

func upsertReception(db *sql.DB, reportsTo string) []string {
	perms := append([]string{}, workmgmt.PermissionsForRole(workmgmt.RoleReception)...)
	perms = append(perms, "dashboard.view")
	emails := make([]string, 0, nReception)
	for i := 1; i <= nReception; i++ {
		id := fmt.Sprintf("WM-RCP-%04d", i)
		email := fmt.Sprintf("reception%d@wm.smartca.in", i)
		data := map[string]any{
			"id": id, "email": email, "fullName": fmt.Sprintf("Receptionist %d", i),
			"role": "reception", "roleName": "reception",
			"department": "Front Office", "status": "active", "passwordHash": passwordHash,
			"permissions": perms, "designation": "Receptionist", "loginId": email,
			"reportsTo": reportsTo, "reports_to": reportsTo,
		}
		raw, _ := json.Marshal(data)
		_, err := db.Exec(`INSERT INTO users (id, data, archived, created_at, updated_at) VALUES ($1,$2,false,NOW(),NOW())
			ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, archived=false, updated_at=NOW()`, id, raw)
		must(err)
		emails = append(emails, email)
		log.Printf("  upserted %s (%s)", id, email)
	}
	return emails
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func loadDotEnv(path string) {
	b, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		k := strings.TrimSpace(parts[0])
		v := strings.TrimSpace(parts[1])
		if os.Getenv(k) == "" {
			_ = os.Setenv(k, v)
		}
	}
}
