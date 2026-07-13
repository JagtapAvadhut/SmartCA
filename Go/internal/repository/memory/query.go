package memory

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
)

// Common sortable fields shared across collections, plus per-collection extras.
var allowedSortFields = map[string]map[string]bool{
	"*": {
		"id": true, "name": true, "createdAt": true, "updatedAt": true,
		"status": true, "email": true, "title": true, "date": true,
		"amount": true, "total": true, "dueDate": true, "issueDate": true,
		"paymentDate": true, "clientName": true, "fullName": true,
		"firstName": true, "lastName": true, "period": true,
	},
	"clients": {
		"revenue": true, "outstanding": true, "city": true, "type": true,
	},
	"invoices": {
		"invoiceNumber": true, "subtotal": true, "paidAmount": true, "clientId": true,
	},
	"payments": {
		"invoiceId": true, "method": true, "reference": true,
	},
	"employees": {
		"designation": true, "department": true, "dateOfJoining": true,
	},
	"users": {
		"role": true, "username": true, "loginId": true, "lastLogin": true,
	},
	"tasks": {
		"priority": true, "assignee": true, "dueDate": true,
	},
	"documents": {
		"fileName": true, "category": true, "uploadedAt": true,
	},
	"gst":   {"returnType": true, "turnover": true, "taxLiability": true},
	"itr":   {"assessmentYear": true, "filingType": true},
	"tds":   {"quarter": true, "formType": true},
	"roc":   {"formType": true, "cin": true},
	"notes": {"content": true, "entityType": true, "entityId": true},
}

func isSortAllowed(collection, field string) bool {
	if field == "" {
		return false
	}
	if allowedSortFields["*"][field] {
		return true
	}
	if m, ok := allowedSortFields[collection]; ok && m[field] {
		return true
	}
	return false
}

func matchesFilters(r models.Record, filters map[string]any) bool {
	if len(filters) == 0 {
		return true
	}
	for k, want := range filters {
		got := r[k]
		if !valuesEqual(got, want) {
			return false
		}
	}
	return true
}

func valuesEqual(got, want any) bool {
	if want == nil {
		return got == nil
	}
	switch w := want.(type) {
	case string:
		return stringValue(got) == w
	case bool:
		b, ok := got.(bool)
		return ok && b == w
	case float64:
		return floatValue(got) == w
	case int:
		return floatValue(got) == float64(w)
	case int64:
		return floatValue(got) == float64(w)
	default:
		return fmt.Sprint(got) == fmt.Sprint(want)
	}
}

func matchesSearch(r models.Record, term string, fields []string) bool {
	term = strings.TrimSpace(strings.ToLower(term))
	if term == "" {
		return true
	}
	if len(fields) > 0 {
		for _, f := range fields {
			if strings.Contains(strings.ToLower(stringValue(r[f])), term) {
				return true
			}
		}
		return false
	}
	for _, v := range r {
		if s, ok := v.(string); ok {
			if strings.Contains(strings.ToLower(s), term) {
				return true
			}
		}
	}
	return false
}

func isArchived(r models.Record) bool {
	if r.GetBool("archived") {
		return true
	}
	return strings.EqualFold(r.GetString("status"), "archived")
}

func sortRecords(items []models.Record, sortBy, sortDir string) {
	desc := strings.EqualFold(sortDir, "desc")
	sort.SliceStable(items, func(i, j int) bool {
		a := items[i][sortBy]
		b := items[j][sortBy]
		cmp := compareAny(a, b)
		if desc {
			return cmp > 0
		}
		return cmp < 0
	})
}

func compareAny(a, b any) int {
	af, aNum := asFloat(a)
	bf, bNum := asFloat(b)
	if aNum && bNum {
		switch {
		case af < bf:
			return -1
		case af > bf:
			return 1
		default:
			return 0
		}
	}
	as := stringValue(a)
	bs := stringValue(b)
	return strings.Compare(as, bs)
}

func asFloat(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case float32:
		return float64(t), true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	case json.Number:
		f, err := t.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(t, 64)
		return f, err == nil
	default:
		return 0, false
	}
}

func stringValue(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case float64:
		if t == float64(int64(t)) {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(t)
	default:
		return fmt.Sprint(t)
	}
}

func floatValue(v any) float64 {
	f, ok := asFloat(v)
	if !ok {
		return 0
	}
	return f
}

func normalizePage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 200 {
		pageSize = 200
	}
	return page, pageSize
}

func paginate(items []models.Record, page, pageSize int) (models.PageResult, []models.Record) {
	page, pageSize = normalizePage(page, pageSize)
	total := len(items)
	totalPages := 0
	if total > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	slice := items[start:end]
	out := make([]models.Record, len(slice))
	for i, r := range slice {
		out[i] = r.Clone()
	}
	return models.PageResult{
		Data:       out,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, out
}
