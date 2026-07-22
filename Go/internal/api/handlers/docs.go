package handlers

import (
	"embed"
	"net/http"
)

//go:embed docs/openapi.yaml docs/swagger.html
var apiDocsFS embed.FS

// OpenAPIYAML serves the embedded OpenAPI 3 specification.
func OpenAPIYAML(w http.ResponseWriter, r *http.Request) {
	data, err := apiDocsFS.ReadFile("docs/openapi.yaml")
	if err != nil {
		http.Error(w, "openapi unavailable", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write(data)
}

// SwaggerUI serves a minimal Swagger UI shell that loads /openapi.yaml.
func SwaggerUI(w http.ResponseWriter, r *http.Request) {
	data, err := apiDocsFS.ReadFile("docs/swagger.html")
	if err != nil {
		http.Error(w, "docs unavailable", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write(data)
}
