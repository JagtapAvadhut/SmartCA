package postgres

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
)

// Generated STORED columns for common FK JSON fields (see migration 002).
var jsonFieldToColumn = map[string]map[string]string{
	"payments":      {"invoiceId": "invoice_id", "clientId": "client_id"},
	"invoices":      {"clientId": "client_id"},
	"companies":     {"clientId": "client_id"},
	"documents":     {"clientId": "client_id"},
	"invoice_items": {"invoiceId": "invoice_id"},
}

var safeJSONKey = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]*$`)

// ListByJSONField uses indexed generated columns when present, otherwise data->>field.
func (s *Store) ListByJSONField(collection, jsonField, value string, includeArchived bool) []models.Record {
	if value == "" || jsonField == "" {
		return nil
	}
	table, err := s.table(collection)
	if err != nil {
		return nil
	}
	var (
		query string
		args  []any
	)
	if col := jsonFieldToColumn[collection][jsonField]; col != "" {
		query = `SELECT data FROM ` + table + ` WHERE ` + col + ` = $1`
		args = []any{value}
	} else {
		if !safeJSONKey.MatchString(jsonField) {
			return nil
		}
		query = `SELECT data FROM ` + table + ` WHERE data->>'` + jsonField + `' = $1`
		args = []any{value}
	}
	if !includeArchived {
		query += ` AND archived = FALSE`
	}
	query += ` ORDER BY created_at ASC, id ASC`
	rows, err := s.q().Query(query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()
	return scanDataRows(rows)
}

// FindUserByIdentifier uses expression indexes on lower(email|username|loginId).
func (s *Store) FindUserByIdentifier(identifier string, includeArchived bool) (models.Record, error) {
	id := strings.ToLower(strings.TrimSpace(identifier))
	if id == "" {
		return nil, apperrors.NotFound("user not found")
	}
	query := `SELECT data FROM users
		WHERE lower(data->>'email') = $1
		   OR lower(data->>'username') = $1
		   OR lower(data->>'loginId') = $1`
	if !includeArchived {
		query += ` AND archived = FALSE`
	}
	// Match GetAll insertion order so duplicate identifiers resolve identically.
	query += ` ORDER BY created_at ASC, id ASC LIMIT 1`
	row := s.q().QueryRow(query, id)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.NotFound("user not found")
		}
		return nil, err
	}
	return decodeRecord(raw)
}

// MarkAllNotificationsRead sets read=true for all non-archived unread notifications.
// Returns the number of rows updated.
func (s *Store) MarkAllNotificationsRead() (int, error) {
	res, err := s.q().Exec(`
		UPDATE notifications
		SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{read}', 'true'::jsonb, true),
		    updated_at = NOW()
		WHERE archived = FALSE
		  AND COALESCE(data->>'read', 'false') NOT IN ('true', '1')`)
	if err != nil {
		return 0, fmt.Errorf("mark notifications read: %w", err)
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}
