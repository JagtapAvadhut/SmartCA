// Package repository defines persistence contracts for application services.
// The in-memory adapter and a future PostgreSQL adapter must satisfy Store.
package repository

import (
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
)

// Session is the runtime auth session contract (not the seeded sessions collection).
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

// Store is the persistence contract used by application services.
// Implementations must not require callers to know about mutexes or maps.
type Store interface {
	Get(collection, id string) (models.Record, error)
	Exists(collection, id string) bool
	Count(collection string, includeArchived bool) int
	GetAll(collection string, includeArchived bool) []models.Record
	List(collection string, q models.Query) models.PageResult
	Create(collection string, rec models.Record) (models.Record, error)
	Update(collection, id string, patch models.Record) (models.Record, error)
	Archive(collection, id string) error
	Restore(collection, id string) error
	PermanentDelete(collection, id string) error
	ReplaceAll(collection string, rows []models.Record)
	Reset(data map[string][]models.Record) error
	Snapshot() map[string][]models.Record
	WithTx(fn func(tx Store) error) error

	CreateSession(sess Session) Session
	GetSession(id string) (Session, bool)
	RevokeSession(id string)
	RevokeUserSessions(userID string)
	ClearSessions()
	FindSessionByToken(token string) (Session, bool)
	RevokeSessionByToken(token string)
}
