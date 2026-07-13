package services

import (
	"strings"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

// SearchService performs cross-collection search.
type SearchService struct {
	store *memory.Store
}

func NewSearchService(store *memory.Store) *SearchService {
	return &SearchService{store: store}
}

// Search returns matching records across primary collections.
func (s *SearchService) Search(q string, limit int) map[string]any {
	q = strings.TrimSpace(q)
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	collections := []string{
		ColClients, ColCompanies, ColInvoices, ColPayments,
		ColEmployees, ColTasks, ColDocuments, ColCompliance,
	}
	results := make([]map[string]any, 0)
	if q == "" {
		return map[string]any{"query": q, "results": results}
	}
	for _, coll := range collections {
		page := s.store.List(coll, models.Query{
			Search:       q,
			SearchFields: SearchFields(coll),
			Page:         1,
			PageSize:     limit,
		})
		for _, r := range page.Data {
			results = append(results, map[string]any{
				"collection": coll,
				"id":         r.ID(),
				"title":      recordTitle(coll, r),
				"record":     r,
			})
			if len(results) >= limit*2 {
				return map[string]any{"query": q, "results": results}
			}
		}
	}
	return map[string]any{"query": q, "results": results}
}

func recordTitle(coll string, r models.Record) string {
	switch coll {
	case ColClients, ColCompanies:
		return r.GetString("name")
	case ColInvoices:
		return r.GetString("invoiceNumber")
	case ColPayments:
		return r.GetString("reference")
	case ColEmployees, ColUsers:
		return r.GetString("fullName")
	case ColTasks:
		return r.GetString("title")
	case ColDocuments:
		return firstNonEmpty(r.GetString("name"), r.GetString("fileName"))
	default:
		return firstNonEmpty(r.GetString("title"), r.GetString("name"), r.ID())
	}
}
