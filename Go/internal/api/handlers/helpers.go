package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/JagtapAvadhut/smartca-backend/internal/api/middleware"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

func rid(r *http.Request) string { return middleware.RequestIDFrom(r.Context()) }

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.UseNumber()
	return dec.Decode(dst)
}

func parseQuery(r *http.Request) models.Query {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("pageSize"))
	filters := map[string]any{}
	if status := q.Get("status"); status != "" {
		filters["status"] = status
	}
	return models.Query{
		Search:   strings.TrimSpace(q.Get("search")),
		Filters:  filters,
		SortBy:   q.Get("sortBy"),
		SortDir:  q.Get("sortDir"),
		Page:     page,
		PageSize: pageSize,
	}
}

func writeList(w http.ResponseWriter, r *http.Request, page models.PageResult) {
	apiresponse.OKList(w, rid(r), page.Data, page.Page, page.PageSize, page.Total)
}

func writeErr(w http.ResponseWriter, r *http.Request, err error) {
	apiresponse.Fail(w, rid(r), err)
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	host := r.RemoteAddr
	if i := strings.LastIndex(host, ":"); i > 0 {
		return host[:i]
	}
	return host
}
