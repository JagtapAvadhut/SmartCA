// Package memory is an in-memory repository for Smart CA demo/dev backends.
//
// Concurrency model:
//   - A single sync.RWMutex guards all business collections and auth sessions.
//   - Reads take RLock and return deep clones so callers cannot mutate store state.
//   - Writes take the exclusive Lock.
//   - WithTx holds the write lock for the duration of multi-entity work. On error it
//     restores a full deep-clone snapshot taken at transaction start (copy-on-write
//     rollback). Nested collection methods detect an open transaction and do not
//     re-acquire the mutex (avoids deadlock).
package memory

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
)

// Known collection names used by seed and services.
var Collections = []string{
	"clients", "companies", "employees", "invoices", "payments", "documents",
	"tasks", "gst", "itr", "tds", "roc", "compliance", "notifications",
	"activities", "calendar", "users", "roles", "permissions", "organization",
	"settings", "auditLogs", "loginHistory", "chat", "departments", "branches",
	"notes", "journals", "sessions",
}

// Default ID prefixes per collection (used when creating without an id).
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
}

// Session is a runtime auth session (separate from the seeded "sessions" collection).
type Session struct {
	ID        string
	UserID    string
	Token     string
	Device    string
	IP        string
	CreatedAt time.Time
	ExpiresAt time.Time
	Active    bool
}

// Store is a concurrency-safe in-memory document store.
// There are no package-level mutable business maps — all state lives on *Store.
type Store struct {
	mu       sync.RWMutex
	txDepth  int // >0 while holding write lock inside WithTx
	data     map[string]map[string]models.Record
	order    map[string][]string
	sessions map[string]Session
}

// NewStore creates an empty store with all known collections initialized.
func NewStore() *Store {
	s := &Store{
		data:     make(map[string]map[string]models.Record, len(Collections)),
		order:    make(map[string][]string, len(Collections)),
		sessions: make(map[string]Session),
	}
	for _, c := range Collections {
		s.data[c] = make(map[string]models.Record)
		s.order[c] = nil
	}
	return s
}

func (s *Store) ensureCollection(name string) {
	if _, ok := s.data[name]; !ok {
		s.data[name] = make(map[string]models.Record)
		s.order[name] = nil
	}
}

func (s *Store) lockRead() {
	if s.txDepth == 0 {
		s.mu.RLock()
	}
}

func (s *Store) unlockRead() {
	if s.txDepth == 0 {
		s.mu.RUnlock()
	}
}

func (s *Store) lockWrite() {
	if s.txDepth == 0 {
		s.mu.Lock()
	}
}

func (s *Store) unlockWrite() {
	if s.txDepth == 0 {
		s.mu.Unlock()
	}
}

// WithTx runs fn under an exclusive write lock. On error, the store is restored
// to the full deep snapshot taken at the start of the transaction.
//
// Transaction = single write mutex: only one WithTx (or write) can proceed at a time;
// readers may still RLock when no transaction is open.
func (s *Store) WithTx(fn func(*Store) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	snapData, snapOrder, snapSessions := s.cloneStateLocked()
	s.txDepth++
	defer func() { s.txDepth-- }()

	if err := fn(s); err != nil {
		s.data = snapData
		s.order = snapOrder
		s.sessions = snapSessions
		return err
	}
	return nil
}

func (s *Store) cloneStateLocked() (
	map[string]map[string]models.Record,
	map[string][]string,
	map[string]Session,
) {
	data := make(map[string]map[string]models.Record, len(s.data))
	order := make(map[string][]string, len(s.order))
	for coll, m := range s.data {
		cm := make(map[string]models.Record, len(m))
		for id, r := range m {
			cm[id] = r.Clone()
		}
		data[coll] = cm
	}
	for coll, ids := range s.order {
		cp := make([]string, len(ids))
		copy(cp, ids)
		order[coll] = cp
	}
	sessions := make(map[string]Session, len(s.sessions))
	for k, v := range s.sessions {
		sessions[k] = v
	}
	return data, order, sessions
}

// Get returns a clone of the record or NotFound.
func (s *Store) Get(collection, id string) (models.Record, error) {
	s.lockRead()
	defer s.unlockRead()
	m, ok := s.data[collection]
	if !ok {
		return nil, apperrors.NotFound(fmt.Sprintf("%s %q not found", collection, id))
	}
	r, ok := m[id]
	if !ok {
		return nil, apperrors.NotFound(fmt.Sprintf("%s %q not found", collection, id))
	}
	return r.Clone(), nil
}

// Exists reports whether an id is present.
func (s *Store) Exists(collection, id string) bool {
	s.lockRead()
	defer s.unlockRead()
	m, ok := s.data[collection]
	if !ok {
		return false
	}
	_, ok = m[id]
	return ok
}

// Count returns the number of non-archived records (or all if includeArchived).
func (s *Store) Count(collection string, includeArchived bool) int {
	s.lockRead()
	defer s.unlockRead()
	ids := s.order[collection]
	n := 0
	for _, id := range ids {
		r := s.data[collection][id]
		if r == nil {
			continue
		}
		if !includeArchived && isArchived(r) {
			continue
		}
		n++
	}
	return n
}

// GetAll returns clones of all records in insertion order.
func (s *Store) GetAll(collection string, includeArchived bool) []models.Record {
	s.lockRead()
	defer s.unlockRead()
	ids := s.order[collection]
	out := make([]models.Record, 0, len(ids))
	for _, id := range ids {
		r := s.data[collection][id]
		if r == nil {
			continue
		}
		if !includeArchived && isArchived(r) {
			continue
		}
		out = append(out, r.Clone())
	}
	return out
}

// ListByJSONField filters GetAll by an exact JSON string field match.
func (s *Store) ListByJSONField(collection, jsonField, value string, includeArchived bool) []models.Record {
	if value == "" || jsonField == "" {
		return nil
	}
	all := s.GetAll(collection, includeArchived)
	out := make([]models.Record, 0)
	for _, r := range all {
		if r.GetString(jsonField) == value {
			out = append(out, r)
		}
	}
	return out
}

// FindUserByIdentifier matches email|username|loginId case-insensitively.
func (s *Store) FindUserByIdentifier(identifier string, includeArchived bool) (models.Record, error) {
	id := strings.ToLower(strings.TrimSpace(identifier))
	if id == "" {
		return nil, apperrors.NotFound("user not found")
	}
	for _, u := range s.GetAll("users", includeArchived) {
		if strings.EqualFold(u.GetString("email"), id) ||
			strings.EqualFold(u.GetString("username"), id) ||
			strings.EqualFold(u.GetString("loginId"), id) {
			return u, nil
		}
	}
	return nil, apperrors.NotFound("user not found")
}

// List filters, searches, sorts, and paginates. Returns cloned records.
func (s *Store) List(collection string, q models.Query) models.PageResult {
	s.lockRead()
	defer s.unlockRead()

	ids := s.order[collection]
	items := make([]models.Record, 0, len(ids))
	for _, id := range ids {
		r := s.data[collection][id]
		if r == nil {
			continue
		}
		if !q.IncludeArchived && isArchived(r) {
			continue
		}
		if !matchesFilters(r, q.Filters) {
			continue
		}
		if !matchesSearch(r, q.Search, q.SearchFields) {
			continue
		}
		items = append(items, r)
	}

	sortBy := q.SortBy
	if sortBy != "" && isSortAllowed(collection, sortBy) {
		sortRecords(items, sortBy, q.SortDir)
	}

	page, _ := paginate(items, q.Page, q.PageSize)
	return page
}

// Create inserts a record. Generates an id when missing. Returns a clone.
func (s *Store) Create(collection string, rec models.Record) (models.Record, error) {
	s.lockWrite()
	defer s.unlockWrite()
	s.ensureCollection(collection)

	r := rec.Clone()
	if r == nil {
		r = models.Record{}
	}
	id := r.ID()
	if id == "" {
		id = s.nextIDLocked(collection)
		r.Set("id", id)
	}
	if _, exists := s.data[collection][id]; exists {
		return nil, apperrors.Conflict(fmt.Sprintf("%s %q already exists", collection, id))
	}
	s.data[collection][id] = r
	s.order[collection] = append(s.order[collection], id)
	return r.Clone(), nil
}

// Update merges fields into an existing record. Returns a clone.
func (s *Store) Update(collection, id string, patch models.Record) (models.Record, error) {
	s.lockWrite()
	defer s.unlockWrite()
	s.ensureCollection(collection)

	existing, ok := s.data[collection][id]
	if !ok {
		return nil, apperrors.NotFound(fmt.Sprintf("%s %q not found", collection, id))
	}
	updated := existing.Clone()
	for k, v := range patch {
		if k == "id" {
			continue
		}
		updated[k] = deepCopyValue(v)
	}
	s.data[collection][id] = updated
	return updated.Clone(), nil
}

// Delete soft-deletes by archiving.
func (s *Store) Delete(collection, id string) error {
	return s.Archive(collection, id)
}

// Archive marks a record archived.
func (s *Store) Archive(collection, id string) error {
	s.lockWrite()
	defer s.unlockWrite()
	s.ensureCollection(collection)
	r, ok := s.data[collection][id]
	if !ok {
		return apperrors.NotFound(fmt.Sprintf("%s %q not found", collection, id))
	}
	cloned := r.Clone()
	cloned.Set("archived", true)
	cloned.Set("archivedAt", time.Now().UTC().Format(time.RFC3339))
	s.data[collection][id] = cloned
	return nil
}

// Restore clears the archived flag.
func (s *Store) Restore(collection, id string) error {
	s.lockWrite()
	defer s.unlockWrite()
	s.ensureCollection(collection)
	r, ok := s.data[collection][id]
	if !ok {
		return apperrors.NotFound(fmt.Sprintf("%s %q not found", collection, id))
	}
	cloned := r.Clone()
	cloned.Set("archived", false)
	delete(cloned, "archivedAt")
	if strings.EqualFold(cloned.GetString("status"), "archived") {
		cloned.Set("status", "active")
	}
	s.data[collection][id] = cloned
	return nil
}

// PermanentDelete removes a record completely.
func (s *Store) PermanentDelete(collection, id string) error {
	s.lockWrite()
	defer s.unlockWrite()
	s.ensureCollection(collection)
	if _, ok := s.data[collection][id]; !ok {
		return apperrors.NotFound(fmt.Sprintf("%s %q not found", collection, id))
	}
	delete(s.data[collection], id)
	ids := s.order[collection]
	for i, x := range ids {
		if x == id {
			s.order[collection] = append(ids[:i], ids[i+1:]...)
			break
		}
	}
	return nil
}

// ReplaceAll replaces an entire collection atomically under the write lock.
func (s *Store) ReplaceAll(collection string, records []models.Record) {
	s.lockWrite()
	defer s.unlockWrite()
	s.replaceAllLocked(collection, records)
}

func (s *Store) replaceAllLocked(collection string, records []models.Record) {
	s.ensureCollection(collection)
	m := make(map[string]models.Record, len(records))
	order := make([]string, 0, len(records))
	// Point collection at the building map so nextIDLocked sees IDs already assigned.
	s.data[collection] = m
	s.order[collection] = order
	for _, rec := range records {
		r := rec.Clone()
		id := r.ID()
		if id == "" {
			id = s.nextIDLocked(collection)
			r.Set("id", id)
		}
		m[id] = r
		order = append(order, id)
	}
	s.order[collection] = order
}

// Reset atomically replaces all collection data and clears auth sessions.
func (s *Store) Reset(data map[string][]models.Record) error {
	s.lockWrite()
	defer s.unlockWrite()

	s.data = make(map[string]map[string]models.Record, len(Collections))
	s.order = make(map[string][]string, len(Collections))
	for _, c := range Collections {
		s.data[c] = make(map[string]models.Record)
		s.order[c] = nil
	}
	for coll, records := range data {
		s.replaceAllLocked(coll, records)
	}
	s.sessions = make(map[string]Session)
	return nil
}

// Snapshot returns a deep copy of all collections for demo reset.
func (s *Store) Snapshot() map[string][]models.Record {
	s.lockRead()
	defer s.unlockRead()
	out := make(map[string][]models.Record, len(s.data))
	for coll, ids := range s.order {
		list := make([]models.Record, 0, len(ids))
		for _, id := range ids {
			if r, ok := s.data[coll][id]; ok {
				list = append(list, r.Clone())
			}
		}
		out[coll] = list
	}
	return out
}

// --- Auth sessions (runtime map, not the seeded sessions collection) ---

func (s *Store) CreateSession(sess Session) Session {
	s.lockWrite()
	defer s.unlockWrite()
	if sess.ID == "" {
		sess.ID = fmt.Sprintf("SES-%s", strconv.FormatInt(time.Now().UnixNano(), 36))
	}
	s.sessions[sess.ID] = sess
	return sess
}

func (s *Store) GetSession(id string) (Session, bool) {
	s.lockRead()
	defer s.unlockRead()
	sess, ok := s.sessions[id]
	return sess, ok
}

func (s *Store) RevokeSession(id string) {
	s.lockWrite()
	defer s.unlockWrite()
	if sess, ok := s.sessions[id]; ok {
		sess.Active = false
		s.sessions[id] = sess
	}
}

func (s *Store) RevokeUserSessions(userID string) {
	s.lockWrite()
	defer s.unlockWrite()
	for id, sess := range s.sessions {
		if sess.UserID == userID {
			sess.Active = false
			s.sessions[id] = sess
		}
	}
}

func (s *Store) ClearSessions() {
	s.lockWrite()
	defer s.unlockWrite()
	s.sessions = make(map[string]Session)
}

func (s *Store) nextIDLocked(collection string) string {
	prefix := idPrefixes[collection]
	if prefix == "" {
		prefix = strings.ToUpper(collection[:min(3, len(collection))]) + "-"
	}
	maxN := 0
	width := 4
	if collection == "invoices" || collection == "payments" {
		width = 5
	}
	for id := range s.data[collection] {
		if !strings.HasPrefix(id, prefix) {
			continue
		}
		n, err := strconv.Atoi(strings.TrimPrefix(id, prefix))
		if err == nil && n > maxN {
			maxN = n
		}
	}
	if maxN == 0 && len(s.data[collection]) == 0 {
		// empty collection — start at 1
	}
	next := maxN + 1
	if next <= 0 {
		return prefix + strings.ToUpper(strconv.FormatInt(time.Now().UnixNano(), 36))
	}
	return fmt.Sprintf("%s%0*d", prefix, width, next)
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
