package postgres

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/lib/pq"
)

// Store implements repository.Store using per-entity PostgreSQL tables (JSONB data column).
type Store struct {
	db *sql.DB
	tx *sql.Tx
}

func NewStore(db *sql.DB) *Store { return &Store{db: db} }

type querier interface {
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
	Exec(query string, args ...any) (sql.Result, error)
}

func (s *Store) q() querier {
	if s.tx != nil {
		return s.tx
	}
	return s.db
}

// collection → physical BASE TABLE
var collectionToTable = map[string]string{
	"users": "users", "roles": "roles", "permissions": "permissions",
	"clients": "clients", "companies": "companies", "employees": "employees",
	"invoices": "invoices", "invoice_items": "invoice_items", "payments": "payments",
	"documents": "documents", "folders": "folders", "tasks": "tasks",
	"activities": "activities", "auditLogs": "audit_logs", "notifications": "notifications",
	"settings": "settings", "gst": "gst", "itr": "itr", "tds": "tds", "roc": "roc",
	"calendar": "calendar_events", "notes": "notes", "organization": "organizations",
	"compliance": "compliance", "chat": "chat", "departments": "departments",
	"branches": "branches", "loginHistory": "login_history", "journals": "journals",
	"sessions": "sessions_data",
}

var knownCollections = []string{
	"users", "roles", "permissions", "clients", "companies", "employees",
	"invoices", "invoice_items", "payments", "documents", "folders", "tasks",
	"activities", "auditLogs", "notifications", "settings", "gst", "itr", "tds", "roc",
	"calendar", "notes", "organization", "compliance", "chat", "departments",
	"branches", "loginHistory", "journals", "sessions",
}

// seedInsertOrder respects FK dependencies (parents before children).
// payments/invoice_items reference invoices; invoices/payments reference clients.
var seedInsertOrder = []string{
	"permissions", "roles", "users", "departments", "branches", "organization", "settings",
	"clients", "companies", "employees",
	"invoices", "invoice_items", "payments",
	"documents", "folders", "tasks", "gst", "itr", "tds", "roc", "compliance",
	"notifications", "activities", "auditLogs", "calendar", "notes", "chat",
	"loginHistory", "journals", "sessions",
}

var idPrefixes = map[string]string{
	"clients": "CLT-", "companies": "CMP-", "employees": "EMP-",
	"invoices": "INV-", "payments": "PAY-", "documents": "DOC-",
	"tasks": "TSK-", "gst": "GST-", "itr": "ITR-", "tds": "TDS-",
	"roc": "ROC-", "compliance": "CMPL-", "notifications": "NTF-",
	"activities": "ACT-", "calendar": "CAL-", "users": "USR-",
	"roles": "ROLE-", "permissions": "PERM-", "organization": "ORG-",
	"settings": "SET-", "auditLogs": "AUD-", "loginHistory": "LH-",
	"chat": "CHAT-", "departments": "DEPT-", "branches": "BR-",
	"notes": "NOTE-", "journals": "JNL-", "sessions": "SES-",
	"folders": "FLD-", "invoice_items": "ITI-",
}

func (s *Store) table(collection string) (string, error) {
	t, ok := collectionToTable[collection]
	if !ok {
		return "", fmt.Errorf("unknown collection %q", collection)
	}
	return t, nil
}

func (s *Store) Get(collection, id string) (models.Record, error) {
	table, err := s.table(collection)
	if err != nil {
		return nil, err
	}
	row := s.q().QueryRow(`SELECT data FROM `+table+` WHERE id = $1`, id)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NotFound(fmt.Sprintf("%s %q not found", collection, id))
		}
		return nil, err
	}
	return decodeRecord(raw)
}

func (s *Store) Exists(collection, id string) bool {
	table, err := s.table(collection)
	if err != nil {
		return false
	}
	var ok bool
	_ = s.q().QueryRow(`SELECT EXISTS(SELECT 1 FROM `+table+` WHERE id = $1)`, id).Scan(&ok)
	return ok
}

func (s *Store) Count(collection string, includeArchived bool) int {
	table, err := s.table(collection)
	if err != nil {
		return 0
	}
	query := `SELECT COUNT(*) FROM ` + table
	if !includeArchived {
		query += ` WHERE archived = FALSE`
	}
	var n int
	_ = s.q().QueryRow(query).Scan(&n)
	return n
}

func (s *Store) GetAll(collection string, includeArchived bool) []models.Record {
	table, err := s.table(collection)
	if err != nil {
		return nil
	}
	query := `SELECT data FROM ` + table
	if !includeArchived {
		query += ` WHERE archived = FALSE`
	}
	query += ` ORDER BY created_at ASC, id ASC`
	rows, err := s.q().Query(query)
	if err != nil {
		return nil
	}
	defer rows.Close()
	return scanDataRows(rows)
}

func (s *Store) List(collection string, q models.Query) models.PageResult {
	all := s.GetAll(collection, q.IncludeArchived)
	items := make([]models.Record, 0, len(all))
	for _, r := range all {
		if !matchesFilters(r, q.Filters) {
			continue
		}
		if !matchesSearch(r, q.Search, q.SearchFields) {
			continue
		}
		items = append(items, r)
	}
	if q.SortBy != "" {
		sortRecords(items, q.SortBy, q.SortDir)
	}
	return paginate(items, q.Page, q.PageSize)
}

func (s *Store) Create(collection string, rec models.Record) (models.Record, error) {
	table, err := s.table(collection)
	if err != nil {
		return nil, err
	}
	r := rec.Clone()
	if r == nil {
		r = models.Record{}
	}
	id := r.ID()
	if id == "" {
		id = s.nextID(collection)
		r.Set("id", id)
	}
	if s.Exists(collection, id) {
		return nil, apperrors.Conflict(fmt.Sprintf("%s %q already exists", collection, id))
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if r.GetString("createdAt") == "" {
		r.Set("createdAt", now)
	}
	r.Set("updatedAt", now)
	if _, ok := r["archived"]; !ok {
		r.Set("archived", false)
	}
	payload, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}
	_, err = s.q().Exec(
		`INSERT INTO `+table+` (id, data, archived, created_at, updated_at) VALUES ($1, $2::jsonb, $3, NOW(), NOW())`,
		id, payload, isArchived(r),
	)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, apperrors.Conflict(fmt.Sprintf("%s %q already exists", collection, id))
		}
		return nil, fmt.Errorf("insert %s: %w", collection, err)
	}
	if collection == "invoices" {
		if err := s.syncInvoiceItems(id, r); err != nil {
			return nil, fmt.Errorf("sync invoice items: %w", err)
		}
	}
	return r.Clone(), nil
}

func (s *Store) Update(collection, id string, patch models.Record) (models.Record, error) {
	table, err := s.table(collection)
	if err != nil {
		return nil, err
	}
	existing, err := s.Get(collection, id)
	if err != nil {
		return nil, err
	}
	updated := existing.Clone()
	for k, v := range patch {
		if k == "id" {
			continue
		}
		updated[k] = deepCopyValue(v)
	}
	updated.Set("updatedAt", time.Now().UTC().Format(time.RFC3339))
	payload, err := json.Marshal(updated)
	if err != nil {
		return nil, err
	}
	_, err = s.q().Exec(
		`UPDATE `+table+` SET data = $1::jsonb, archived = $2, updated_at = NOW() WHERE id = $3`,
		payload, isArchived(updated), id,
	)
	if err != nil {
		return nil, fmt.Errorf("update %s: %w", collection, err)
	}
	if collection == "invoices" {
		if err := s.syncInvoiceItems(id, updated); err != nil {
			return nil, fmt.Errorf("sync invoice items: %w", err)
		}
	}
	return updated.Clone(), nil
}

func (s *Store) Archive(collection, id string) error {
	rec, err := s.Get(collection, id)
	if err != nil {
		return err
	}
	rec.Set("archived", true)
	rec.Set("archivedAt", time.Now().UTC().Format(time.RFC3339))
	_, err = s.Update(collection, id, rec)
	return err
}

func (s *Store) Restore(collection, id string) error {
	rec, err := s.Get(collection, id)
	if err != nil {
		return err
	}
	rec.Set("archived", false)
	delete(rec, "archivedAt")
	if strings.EqualFold(rec.GetString("status"), "archived") {
		rec.Set("status", "active")
	}
	_, err = s.Update(collection, id, rec)
	return err
}

func (s *Store) PermanentDelete(collection, id string) error {
	table, err := s.table(collection)
	if err != nil {
		return err
	}
	// Enforce referential cleanup before FK RESTRICT blocks hard deletes.
	switch collection {
	case "clients":
		if _, err := s.q().Exec(`DELETE FROM payments WHERE client_id = $1 OR data->>'clientId' = $1`, id); err != nil {
			return err
		}
		if _, err := s.q().Exec(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE client_id = $1 OR data->>'clientId' = $1)`, id); err != nil {
			return err
		}
		if _, err := s.q().Exec(`DELETE FROM invoices WHERE client_id = $1 OR data->>'clientId' = $1`, id); err != nil {
			return err
		}
	case "invoices":
		if _, err := s.q().Exec(`DELETE FROM payments WHERE invoice_id = $1 OR data->>'invoiceId' = $1`, id); err != nil {
			return err
		}
		if _, err := s.q().Exec(`DELETE FROM invoice_items WHERE invoice_id = $1`, id); err != nil {
			return err
		}
	}
	res, err := s.q().Exec(`DELETE FROM `+table+` WHERE id = $1`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return apperrors.NotFound(fmt.Sprintf("%s %q not found", collection, id))
	}
	return nil
}

func (s *Store) ReplaceAll(collection string, rows []models.Record) {
	_ = s.replaceAll(collection, rows)
}

func (s *Store) replaceAll(collection string, rows []models.Record) error {
	table, err := s.table(collection)
	if err != nil {
		return err
	}
	if _, err := s.q().Exec(`DELETE FROM ` + table); err != nil {
		return fmt.Errorf("clear %s: %w", collection, err)
	}
	for _, rec := range rows {
		r := rec.Clone()
		if r == nil {
			continue
		}
		id := r.ID()
		if id == "" {
			continue
		}
		now := time.Now().UTC().Format(time.RFC3339)
		if r.GetString("createdAt") == "" {
			r.Set("createdAt", now)
		}
		if r.GetString("updatedAt") == "" {
			r.Set("updatedAt", now)
		}
		payload, err := json.Marshal(r)
		if err != nil {
			return fmt.Errorf("marshal %s %s: %w", collection, id, err)
		}
		if _, err := s.q().Exec(
			`INSERT INTO `+table+` (id, data, archived, created_at, updated_at)
			 VALUES ($1, $2::jsonb, $3, NOW(), NOW())
			 ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, archived = EXCLUDED.archived, updated_at = NOW()`,
			id, payload, isArchived(r),
		); err != nil {
			return fmt.Errorf("insert %s %s: %w", collection, id, err)
		}
	}
	return nil
}

func (s *Store) Reset(data map[string][]models.Record) error {
	return s.WithTx(func(tx repository.Store) error {
		ps := tx.(*Store)
		// Delete children before parents (reverse of insert order).
		for i := len(seedInsertOrder) - 1; i >= 0; i-- {
			c := seedInsertOrder[i]
			table, err := ps.table(c)
			if err != nil {
				continue
			}
			if _, err := ps.q().Exec(`DELETE FROM ` + table); err != nil {
				return fmt.Errorf("delete %s: %w", c, err)
			}
		}
		for _, c := range knownCollections {
			if containsStr(seedInsertOrder, c) {
				continue
			}
			table, err := ps.table(c)
			if err != nil {
				continue
			}
			if _, err := ps.q().Exec(`DELETE FROM ` + table); err != nil {
				return fmt.Errorf("delete %s: %w", c, err)
			}
		}
		if _, err := ps.q().Exec(`DELETE FROM auth_sessions`); err != nil {
			return err
		}
		seen := map[string]bool{}
		for _, collection := range seedInsertOrder {
			seen[collection] = true
			if err := ps.replaceAll(collection, data[collection]); err != nil {
				return err
			}
		}
		for collection, records := range data {
			if seen[collection] {
				continue
			}
			if err := ps.replaceAll(collection, records); err != nil {
				return err
			}
		}
		return nil
	})
}

func containsStr(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func (s *Store) Snapshot() map[string][]models.Record {
	out := make(map[string][]models.Record)
	for _, c := range knownCollections {
		out[c] = s.GetAll(c, true)
	}
	return out
}

func (s *Store) WithTx(fn func(tx repository.Store) error) error {
	if s.tx != nil {
		return fn(s)
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	txStore := &Store{db: s.db, tx: tx}
	if err := fn(txStore); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (s *Store) nextID(collection string) string {
	table, err := s.table(collection)
	if err != nil {
		return "ID-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	prefix := idPrefixes[collection]
	if prefix == "" {
		n := 3
		if len(collection) < n {
			n = len(collection)
		}
		prefix = strings.ToUpper(collection[:n]) + "-"
	}
	width := 4
	if collection == "invoices" || collection == "payments" {
		width = 5
	}
	rows, err := s.q().Query(`SELECT id FROM ` + table)
	if err != nil {
		return prefix + strings.ToUpper(strconv.FormatInt(time.Now().UnixNano(), 36))
	}
	defer rows.Close()
	maxN := 0
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue
		}
		if !strings.HasPrefix(id, prefix) {
			continue
		}
		n, err := strconv.Atoi(strings.TrimPrefix(id, prefix))
		if err == nil && n > maxN {
			maxN = n
		}
	}
	return fmt.Sprintf("%s%0*d", prefix, width, maxN+1)
}

// syncInvoiceItems replaces normalized line items for an invoice from JSON data.items.
func (s *Store) syncInvoiceItems(invoiceID string, inv models.Record) error {
	if _, err := s.q().Exec(`DELETE FROM invoice_items WHERE invoice_id = $1`, invoiceID); err != nil {
		return err
	}
	rawItems, ok := inv["items"]
	if !ok || rawItems == nil {
		return nil
	}
	items, ok := rawItems.([]any)
	if !ok {
		return nil
	}
	for i, it := range items {
		itemMap, ok := it.(map[string]any)
		if !ok {
			if rec, ok2 := it.(models.Record); ok2 {
				itemMap = map[string]any(rec)
			} else {
				continue
			}
		}
		itemID := fmt.Sprintf("%s-ITEM-%03d", invoiceID, i+1)
		if id, _ := itemMap["id"].(string); id != "" {
			itemID = id
		}
		// invoice_id is GENERATED ALWAYS AS (data->>'invoiceId') — must live in JSON only.
		itemMap["id"] = itemID
		itemMap["invoiceId"] = invoiceID
		payload, err := json.Marshal(itemMap)
		if err != nil {
			continue
		}
		_, err = s.q().Exec(
			`INSERT INTO invoice_items (id, data, archived, created_at, updated_at)
			 VALUES ($1, $2::jsonb, false, NOW(), NOW())
			 ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
			itemID, payload,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func decodeRecord(raw []byte) (models.Record, error) {
	var rec models.Record
	if err := json.Unmarshal(raw, &rec); err != nil {
		return nil, err
	}
	return rec, nil
}

func scanDataRows(rows *sql.Rows) []models.Record {
	out := make([]models.Record, 0)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			continue
		}
		rec, err := decodeRecord(raw)
		if err != nil {
			continue
		}
		out = append(out, rec)
	}
	return out
}

func deepCopyValue(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, vv := range t {
			out[k] = deepCopyValue(vv)
		}
		return out
	case models.Record:
		return t.Clone()
	case []any:
		out := make([]any, len(t))
		for i, vv := range t {
			out[i] = deepCopyValue(vv)
		}
		return out
	default:
		return v
	}
}

var _ repository.Store = (*Store)(nil)
