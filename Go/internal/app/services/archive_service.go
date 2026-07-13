package services

import (
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
	"github.com/JagtapAvadhut/smartca-backend/internal/seed"
)

// ArchiveService lists and manages soft-deleted records.
type ArchiveService struct {
	store    *memory.Store
	snapshot map[string][]models.Record
}

func NewArchiveService(store *memory.Store) *ArchiveService {
	return &ArchiveService{store: store}
}

// SetSnapshot stores seed data for demo reset.
func (a *ArchiveService) SetSnapshot(data map[string][]models.Record) {
	a.snapshot = data
}

func (a *ArchiveService) List(collection string) []models.Record {
	all := a.store.GetAll(collection, true)
	out := make([]models.Record, 0)
	for _, r := range all {
		if r.GetBool("archived") {
			out = append(out, r)
		}
	}
	return out
}

func (a *ArchiveService) ListAll() map[string][]models.Record {
	out := map[string][]models.Record{}
	for _, coll := range memory.Collections {
		items := a.List(coll)
		if len(items) > 0 {
			out[coll] = items
		}
	}
	return out
}

func (a *ArchiveService) Restore(collection, id string) error {
	return a.store.Restore(collection, id)
}

func (a *ArchiveService) PermanentDelete(collection, id string) error {
	return a.store.PermanentDelete(collection, id)
}

func (a *ArchiveService) BulkRestore(items []struct{ Collection, ID string }) (int, error) {
	n := 0
	for _, it := range items {
		if err := a.store.Restore(it.Collection, it.ID); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}

func (a *ArchiveService) BulkPermanentDelete(items []struct{ Collection, ID string }) (int, error) {
	n := 0
	for _, it := range items {
		if err := a.store.PermanentDelete(it.Collection, it.ID); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}

// DemoReset reloads seed snapshot. Caller must enforce RBAC + config flag.
func (a *ArchiveService) DemoReset() error {
	data := a.snapshot
	if data == nil {
		loaded, err := seed.LoadSeed()
		if err != nil {
			return apperrors.Internal("failed to reload seed", err)
		}
		data = loaded
		a.snapshot = loaded
	}
	// deep-ish copy for reset
	clone := make(map[string][]models.Record, len(data))
	for k, list := range data {
		cp := make([]models.Record, len(list))
		for i, r := range list {
			cp[i] = r.Clone()
		}
		clone[k] = cp
	}
	a.store.Reset(clone)
	if err := seed.ValidateIntegrity(a.store); err != nil {
		return apperrors.Internal("reset integrity failed", err)
	}
	return nil
}

// SettingsService reads/updates organization settings singleton.
type SettingsService struct {
	store *memory.Store
}

func NewSettingsService(store *memory.Store) *SettingsService {
	return &SettingsService{store: store}
}

func (s *SettingsService) Get() (models.Record, error) {
	all := s.store.GetAll(ColSettings, true)
	if len(all) == 0 {
		return nil, apperrors.NotFound("settings not found")
	}
	return all[0], nil
}

func (s *SettingsService) Update(patch models.Record) (models.Record, error) {
	cur, err := s.Get()
	if err != nil {
		return nil, err
	}
	return s.store.Update(ColSettings, cur.ID(), patch)
}

func (s *SettingsService) GetOrganization() (models.Record, error) {
	all := s.store.GetAll(ColOrganization, true)
	if len(all) == 0 {
		return nil, apperrors.NotFound("organization not found")
	}
	return all[0], nil
}

func (s *SettingsService) UpdateOrganization(patch models.Record) (models.Record, error) {
	cur, err := s.GetOrganization()
	if err != nil {
		return nil, err
	}
	return s.store.Update(ColOrganization, cur.ID(), patch)
}
