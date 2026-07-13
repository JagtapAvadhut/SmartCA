package seed

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

//go:embed data/*.json
var seedFS embed.FS

type filePayload struct {
	Data     []models.Record `json:"data"`
	Sessions []models.Record `json:"sessions"` // chat.json
}

// collectionFiles maps embedded filenames to store collection names.
var collectionFiles = map[string]string{
	"clients.json":       "clients",
	"companies.json":     "companies",
	"employees.json":     "employees",
	"invoices.json":      "invoices",
	"payments.json":      "payments",
	"documents.json":     "documents",
	"tasks.json":         "tasks",
	"gst.json":           "gst",
	"itr.json":           "itr",
	"tds.json":           "tds",
	"roc.json":           "roc",
	"compliance.json":    "compliance",
	"notifications.json": "notifications",
	"activities.json":    "activities",
	"calendar.json":      "calendar",
	"users.json":         "users",
	"roles.json":         "roles",
	"permissions.json":   "permissions",
	"organization.json":  "organization",
	"settings.json":      "settings",
	"auditLogs.json":     "auditLogs",
	"loginHistory.json":  "loginHistory",
	"chat.json":          "chat",
	"departments.json":   "departments",
	"branches.json":      "branches",
	"sessions.json":      "sessions",
}

const noteTimestamp = "2025-04-01T10:00:00Z"

// LoadSeed parses embedded JSON into collection → records.
// User passwords are bcrypt-hashed (cost 10); plaintext password is removed.
// Two deterministic notes are appended.
func LoadSeed() (map[string][]models.Record, error) {
	out := make(map[string][]models.Record, len(collectionFiles)+2)

	for _, coll := range memory.Collections {
		out[coll] = nil
	}

	entries, err := seedFS.ReadDir("data")
	if err != nil {
		return nil, fmt.Errorf("read seed data: %w", err)
	}

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		coll, ok := collectionFiles[e.Name()]
		if !ok {
			continue
		}
		raw, err := seedFS.ReadFile("data/" + e.Name())
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", e.Name(), err)
		}
		records, err := parseSeedFile(e.Name(), coll, raw)
		if err != nil {
			return nil, err
		}
		out[coll] = records
	}

	if users, ok := out["users"]; ok {
		hashed, err := hashUserPasswords(users)
		if err != nil {
			return nil, err
		}
		out["users"] = hashed
	}

	out["notes"] = seedNotes()
	if out["journals"] == nil {
		out["journals"] = []models.Record{}
	}

	return out, nil
}

func parseSeedFile(filename, collection string, raw []byte) ([]models.Record, error) {
	switch collection {
	case "organization":
		var obj models.Record
		if err := json.Unmarshal(raw, &obj); err != nil {
			return nil, fmt.Errorf("parse %s: %w", filename, err)
		}
		if obj.ID() == "" {
			obj.Set("id", "ORG-001")
		}
		return []models.Record{obj}, nil

	case "settings":
		var obj models.Record
		if err := json.Unmarshal(raw, &obj); err != nil {
			return nil, fmt.Errorf("parse %s: %w", filename, err)
		}
		if obj.ID() == "" {
			obj.Set("id", "SET-001")
		}
		return []models.Record{obj}, nil

	case "chat":
		var payload filePayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			return nil, fmt.Errorf("parse %s: %w", filename, err)
		}
		return payload.Sessions, nil

	default:
		var payload filePayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			var arr []models.Record
			if err2 := json.Unmarshal(raw, &arr); err2 != nil {
				return nil, fmt.Errorf("parse %s: %w", filename, err)
			}
			return arr, nil
		}
		return payload.Data, nil
	}
}

func hashUserPasswords(users []models.Record) ([]models.Record, error) {
	out := make([]models.Record, 0, len(users))
	for _, u := range users {
		r := u.Clone()
		pw := r.GetString("password")
		if pw != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(pw), 10)
			if err != nil {
				return nil, fmt.Errorf("hash password for %s: %w", r.ID(), err)
			}
			r.Set("passwordHash", string(hash))
			delete(r, "password")
		}
		out = append(out, r)
	}
	return out, nil
}

func seedNotes() []models.Record {
	return []models.Record{
		{
			"id":         "NOTE-0001",
			"title":      "Client onboarding checklist",
			"content":    "Collect PAN, GSTIN, and engagement letter before first filing.",
			"entityType": "clients",
			"entityId":   "CLT-0001",
			"createdBy":  "USR-0001",
			"createdAt":  noteTimestamp,
			"updatedAt":  noteTimestamp,
		},
		{
			"id":         "NOTE-0002",
			"title":      "Invoice follow-up",
			"content":    "Follow up on outstanding invoices older than 30 days.",
			"entityType": "invoices",
			"entityId":   "INV-00001",
			"createdBy":  "USR-0001",
			"createdAt":  noteTimestamp,
			"updatedAt":  noteTimestamp,
		},
	}
}

// ValidateIntegrity checks referential links commonly used by the app.
// Returns an error listing all issues found (does not stop at the first).
func ValidateIntegrity(store *memory.Store) error {
	if store == nil {
		return fmt.Errorf("store is nil")
	}

	clientIDs := idSet(store, "clients")
	invoiceIDs := idSet(store, "invoices")
	employeeIDs := idSet(store, "employees")

	var issues []string

	for _, inv := range store.GetAll("invoices", true) {
		cid := inv.GetString("clientId")
		if cid != "" && !clientIDs[cid] {
			issues = append(issues, fmt.Sprintf("invoice %s references missing clientId %s", inv.ID(), cid))
		}
		createdBy := inv.GetString("createdBy")
		if createdBy != "" && !employeeIDs[createdBy] {
			issues = append(issues, fmt.Sprintf("invoice %s references missing createdBy %s", inv.ID(), createdBy))
		}
	}

	for _, pay := range store.GetAll("payments", true) {
		iid := pay.GetString("invoiceId")
		if iid != "" && !invoiceIDs[iid] {
			issues = append(issues, fmt.Sprintf("payment %s references missing invoiceId %s", pay.ID(), iid))
		}
		cid := pay.GetString("clientId")
		if cid != "" && !clientIDs[cid] {
			issues = append(issues, fmt.Sprintf("payment %s references missing clientId %s", pay.ID(), cid))
		}
	}

	for _, cmp := range store.GetAll("companies", true) {
		cid := cmp.GetString("clientId")
		if cid != "" && !clientIDs[cid] {
			issues = append(issues, fmt.Sprintf("company %s references missing clientId %s", cmp.ID(), cid))
		}
	}

	for _, coll := range []string{"gst", "itr", "tds", "roc", "compliance", "documents", "tasks"} {
		for _, rec := range store.GetAll(coll, true) {
			cid := rec.GetString("clientId")
			if cid != "" && !clientIDs[cid] {
				issues = append(issues, fmt.Sprintf("%s %s references missing clientId %s", coll, rec.ID(), cid))
			}
		}
	}

	for _, u := range store.GetAll("users", true) {
		if u.GetString("passwordHash") == "" && u.GetString("password") != "" {
			issues = append(issues, fmt.Sprintf("user %s still has plaintext password", u.ID()))
		}
		// Demo seed may include users without matching employees; do not fail startup.
	}

	for _, n := range store.GetAll("notes", true) {
		if n.ID() == "" {
			issues = append(issues, "note missing id")
		}
	}

	if len(issues) > 0 {
		return fmt.Errorf("seed integrity: %d issue(s):\n  - %s", len(issues), strings.Join(issues, "\n  - "))
	}
	return nil
}

func idSet(store *memory.Store, collection string) map[string]bool {
	set := make(map[string]bool)
	for _, r := range store.GetAll(collection, true) {
		if id := r.ID(); id != "" {
			set[id] = true
		}
	}
	return set
}
