package repository

import (
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

// AdaptMemory wraps *memory.Store as the Store contract.
func AdaptMemory(s *memory.Store) Store {
	return &memoryAdapter{inner: s}
}

type memoryAdapter struct {
	inner *memory.Store
}

func toRepoSession(s memory.Session) Session {
	return Session{
		ID: s.ID, UserID: s.UserID, Token: s.Token, Device: s.Device, IP: s.IP,
		CreatedAt: s.CreatedAt, ExpiresAt: s.ExpiresAt, Active: s.Active,
	}
}

func toMemSession(s Session) memory.Session {
	return memory.Session{
		ID: s.ID, UserID: s.UserID, Token: s.Token, Device: s.Device, IP: s.IP,
		CreatedAt: s.CreatedAt, ExpiresAt: s.ExpiresAt, Active: s.Active,
	}
}

func (a *memoryAdapter) Get(c, id string) (models.Record, error) { return a.inner.Get(c, id) }
func (a *memoryAdapter) Exists(c, id string) bool                { return a.inner.Exists(c, id) }
func (a *memoryAdapter) Count(c string, includeArchived bool) int {
	return a.inner.Count(c, includeArchived)
}
func (a *memoryAdapter) GetAll(c string, includeArchived bool) []models.Record {
	return a.inner.GetAll(c, includeArchived)
}
func (a *memoryAdapter) List(c string, q models.Query) models.PageResult {
	return a.inner.List(c, q)
}
func (a *memoryAdapter) Create(c string, rec models.Record) (models.Record, error) {
	return a.inner.Create(c, rec)
}
func (a *memoryAdapter) Update(c, id string, patch models.Record) (models.Record, error) {
	return a.inner.Update(c, id, patch)
}
func (a *memoryAdapter) Archive(c, id string) error         { return a.inner.Archive(c, id) }
func (a *memoryAdapter) Restore(c, id string) error         { return a.inner.Restore(c, id) }
func (a *memoryAdapter) PermanentDelete(c, id string) error { return a.inner.PermanentDelete(c, id) }
func (a *memoryAdapter) ReplaceAll(c string, rows []models.Record) {
	a.inner.ReplaceAll(c, rows)
}
func (a *memoryAdapter) Reset(data map[string][]models.Record) error {
	return a.inner.Reset(data)
}
func (a *memoryAdapter) Snapshot() map[string][]models.Record { return a.inner.Snapshot() }
func (a *memoryAdapter) WithTx(fn func(tx Store) error) error {
	return a.inner.WithTx(func(st *memory.Store) error {
		return fn(&memoryAdapter{inner: st})
	})
}
func (a *memoryAdapter) CreateSession(sess Session) Session {
	return toRepoSession(a.inner.CreateSession(toMemSession(sess)))
}
func (a *memoryAdapter) GetSession(id string) (Session, bool) {
	s, ok := a.inner.GetSession(id)
	return toRepoSession(s), ok
}
func (a *memoryAdapter) RevokeSession(id string)          { a.inner.RevokeSession(id) }
func (a *memoryAdapter) RevokeUserSessions(userID string) { a.inner.RevokeUserSessions(userID) }
func (a *memoryAdapter) ClearSessions()                   { a.inner.ClearSessions() }
func (a *memoryAdapter) FindSessionByToken(token string) (Session, bool) {
	s, ok := a.inner.FindSessionByToken(token)
	return toRepoSession(s), ok
}
func (a *memoryAdapter) RevokeSessionByToken(token string) {
	a.inner.RevokeSessionByToken(token)
}

// Compile-time check.
var _ Store = (*memoryAdapter)(nil)
