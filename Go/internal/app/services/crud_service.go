package services

import (
	"strings"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/auth"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

// CRUDService is a generic collection wrapper around the memory store.
type CRUDService struct {
	store      repository.Store
	collection string
	search     []string
}

func NewCRUDService(store repository.Store, collection string) *CRUDService {
	return &CRUDService{
		store:      store,
		collection: collection,
		search:     SearchFields(collection),
	}
}

func (c *CRUDService) Collection() string { return c.collection }

func (c *CRUDService) List(q models.Query) models.PageResult {
	if len(q.SearchFields) == 0 {
		q.SearchFields = c.search
	}
	page := c.store.List(c.collection, q)
	if c.collection == ColUsers {
		for i, r := range page.Data {
			page.Data[i] = stripSecrets(r)
		}
	}
	return page
}

func (c *CRUDService) Get(id string) (models.Record, error) {
	rec, err := c.store.Get(c.collection, id)
	if err != nil {
		return nil, err
	}
	if c.collection == ColUsers {
		return stripSecrets(rec), nil
	}
	return rec, nil
}

func (c *CRUDService) Create(data models.Record) (models.Record, error) {
	if data == nil {
		data = models.Record{}
	}
	// Chat IDs are always server-generated UUIDs — never accept client-supplied ids.
	if c.collection == ColChat {
		delete(data, "id")
	}
	if err := validateCreate(c.collection, data); err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if data.GetString("createdAt") == "" {
		data.Set("createdAt", now)
	}
	data.Set("updatedAt", now)
	if c.collection == ColUsers {
		if err := prepareUserSecrets(data); err != nil {
			return nil, err
		}
	}
	rec, err := c.store.Create(c.collection, data)
	if err != nil {
		return nil, err
	}
	if c.collection == ColUsers {
		return stripSecrets(rec), nil
	}
	return rec, nil
}

func (c *CRUDService) Update(id string, patch models.Record) (models.Record, error) {
	if patch == nil {
		return nil, apperrors.BadRequest("empty patch")
	}
	patch.Set("updatedAt", time.Now().UTC().Format(time.RFC3339))
	if c.collection == ColUsers {
		if err := prepareUserSecrets(patch); err != nil {
			return nil, err
		}
	}
	rec, err := c.store.Update(c.collection, id, patch)
	if err != nil {
		return nil, err
	}
	if c.collection == ColUsers {
		return stripSecrets(rec), nil
	}
	return rec, nil
}

func (c *CRUDService) Archive(id string) error {
	return c.store.Archive(c.collection, id)
}

func (c *CRUDService) Restore(id string) error {
	return c.store.Restore(c.collection, id)
}

func (c *CRUDService) PermanentDelete(id string) error {
	return c.store.PermanentDelete(c.collection, id)
}

// Duplicate clones a record with a new id and optional overrides.
func (c *CRUDService) Duplicate(id string, overrides models.Record) (models.Record, error) {
	src, err := c.store.Get(c.collection, id)
	if err != nil {
		return nil, err
	}
	copyRec := src.Clone()
	delete(copyRec, "id")
	delete(copyRec, "archived")
	delete(copyRec, "archivedAt")
	now := time.Now().UTC().Format(time.RFC3339)
	copyRec.Set("createdAt", now)
	copyRec.Set("updatedAt", now)
	for k, v := range overrides {
		copyRec[k] = v
	}
	return c.store.Create(c.collection, copyRec)
}

func stripSecrets(user models.Record) models.Record {
	out := user.Clone()
	delete(out, "password")
	delete(out, "passwordHash")
	return out
}

func validateCreate(collection string, data models.Record) error {
	switch collection {
	case ColClients:
		if strings.TrimSpace(data.GetString("name")) == "" {
			return apperrors.Validation("client name is required")
		}
	case ColCompanies:
		if strings.TrimSpace(data.GetString("name")) == "" {
			return apperrors.Validation("company name is required")
		}
	case ColEmployees:
		if strings.TrimSpace(data.GetString("firstName")) == "" && strings.TrimSpace(data.GetString("fullName")) == "" {
			return apperrors.Validation("employee name is required")
		}
	case ColTasks:
		if strings.TrimSpace(data.GetString("title")) == "" {
			return apperrors.Validation("task title is required")
		}
	case ColNotes:
		if strings.TrimSpace(data.GetString("title")) == "" && strings.TrimSpace(data.GetString("content")) == "" {
			return apperrors.Validation("note title or content is required")
		}
	case ColRoles:
		if strings.TrimSpace(data.GetString("name")) == "" {
			return apperrors.Validation("role name is required")
		}
	}
	return nil
}

func prepareUserSecrets(data models.Record) error {
	plain := data.GetString("password")
	if plain == "" {
		delete(data, "password")
		return nil
	}
	hash, err := auth.HashPassword(plain)
	if err != nil {
		return apperrors.Internal("failed to hash password", err)
	}
	data.Set("passwordHash", hash)
	delete(data, "password")
	return nil
}
