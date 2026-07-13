package models

import "encoding/json"

// Record is the in-memory entity envelope. Typed accessors live in services;
// seed JSON is preserved as flexible maps for full frontend field compatibility.
type Record map[string]any

func (r Record) ID() string {
	if r == nil {
		return ""
	}
	if v, ok := r["id"].(string); ok {
		return v
	}
	return ""
}

func (r Record) Clone() Record {
	if r == nil {
		return nil
	}
	out := make(Record, len(r))
	for k, v := range r {
		out[k] = deepCopy(v)
	}
	return out
}

func (r Record) GetString(key string) string {
	if r == nil {
		return ""
	}
	switch v := r[key].(type) {
	case string:
		return v
	case json.Number:
		return v.String()
	default:
		return ""
	}
}

func (r Record) GetFloat(key string) float64 {
	if r == nil {
		return 0
	}
	switch v := r[key].(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case json.Number:
		f, _ := v.Float64()
		return f
	default:
		return 0
	}
}

func (r Record) GetBool(key string) bool {
	if r == nil {
		return false
	}
	v, _ := r[key].(bool)
	return v
}

func (r Record) Set(key string, val any) {
	r[key] = val
}

func deepCopy(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, vv := range t {
			out[k] = deepCopy(vv)
		}
		return out
	case Record:
		return t.Clone()
	case []any:
		out := make([]any, len(t))
		for i, vv := range t {
			out[i] = deepCopy(vv)
		}
		return out
	default:
		return v
	}
}

// Query describes list/search/filter/sort/pagination.
type Query struct {
	Search          string
	SearchFields    []string
	Filters         map[string]any
	SortBy          string
	SortDir         string // asc|desc
	Page            int
	PageSize        int
	IncludeArchived bool
}

type PageResult struct {
	Data       []Record
	Total      int
	Page       int
	PageSize   int
	TotalPages int
}
