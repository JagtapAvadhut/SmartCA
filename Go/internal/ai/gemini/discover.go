package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
)

// Fallback aliases used when discovery is unavailable (official "latest" pointers).
// These are not pinned version strings — Google resolves them to the current release.
var fallbackGenerateModels = []string{
	"gemini-flash-latest",
	"gemini-pro-latest",
}

type listModelsResponse struct {
	Models []modelInfo `json:"models"`
}

type modelInfo struct {
	Name                       string   `json:"name"`
	DisplayName                string   `json:"displayName"`
	SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
}

// ListGenerateModels returns model IDs that support generateContent, preferring
// Flash/Pro latest aliases and stable Gemini chat models. Does not hardcode a
// single version — discovery comes from the live API when possible.
func (c *Client) ListGenerateModels(ctx context.Context) ([]string, error) {
	url := fmt.Sprintf("%s/models?pageSize=200", c.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	httpReq.Header.Set("X-goog-api-key", c.apiKey)

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil || strings.Contains(strings.ToLower(err.Error()), "timeout") {
			return nil, fmt.Errorf("%w: %v", ErrTimeout, err)
		}
		return nil, fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	defer httpResp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(httpResp.Body, 4<<20))

	if httpResp.StatusCode >= 400 {
		var parsed generateContentResponse
		_ = json.Unmarshal(raw, &parsed)
		msg := truncate(string(raw), 200)
		if parsed.Error != nil && parsed.Error.DisplayMessage() != "" {
			msg = parsed.Error.DisplayMessage()
		}
		return nil, classifyHTTP(httpResp.StatusCode, msg)
	}

	var parsed listModelsResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMalformed, err)
	}

	seen := map[string]struct{}{}
	var out []string
	add := func(id string) {
		id = strings.TrimSpace(id)
		if id == "" {
			return
		}
		if _, ok := seen[id]; ok {
			return
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}

	// Prefer official latest aliases when present.
	for _, m := range parsed.Models {
		id := strings.TrimPrefix(m.Name, "models/")
		if id == "gemini-flash-latest" || id == "gemini-pro-latest" {
			if supportsGenerate(m.SupportedGenerationMethods) {
				add(id)
			}
		}
	}

	var flash, pro, other []string
	for _, m := range parsed.Models {
		if !supportsGenerate(m.SupportedGenerationMethods) {
			continue
		}
		id := strings.TrimPrefix(m.Name, "models/")
		lower := strings.ToLower(id)
		if strings.Contains(lower, "embedding") ||
			strings.Contains(lower, "tts") ||
			strings.Contains(lower, "image") ||
			strings.Contains(lower, "robotics") ||
			strings.Contains(lower, "computer-use") {
			continue
		}
		if !strings.Contains(lower, "gemini") {
			continue
		}
		switch {
		case strings.Contains(lower, "flash") && !strings.Contains(lower, "lite"):
			flash = append(flash, id)
		case strings.Contains(lower, "pro"):
			pro = append(pro, id)
		default:
			other = append(other, id)
		}
	}
	sort.Strings(flash)
	sort.Strings(pro)
	sort.Strings(other)
	// Prefer newer-looking IDs first (reverse lexical often works for dated names).
	reverse(flash)
	reverse(pro)
	reverse(other)
	for _, id := range flash {
		add(id)
	}
	for _, id := range pro {
		add(id)
	}
	for _, id := range other {
		add(id)
	}

	if len(out) == 0 {
		return append([]string{}, fallbackGenerateModels...), nil
	}
	return out, nil
}

// ResolveDefaultModel picks Flash latest when available, else first discovered model.
func ResolveDefaultModel(models []string) string {
	for _, id := range models {
		if id == "gemini-flash-latest" {
			return id
		}
	}
	for _, id := range models {
		lower := strings.ToLower(id)
		if strings.Contains(lower, "flash") && !strings.Contains(lower, "lite") {
			return id
		}
	}
	if len(models) > 0 {
		return models[0]
	}
	return "gemini-flash-latest"
}

// FallbackModels returns official latest aliases when no API key is available.
func FallbackModels() []string {
	return append([]string{}, fallbackGenerateModels...)
}

func supportsGenerate(methods []string) bool {
	for _, m := range methods {
		if strings.EqualFold(m, "generateContent") || strings.EqualFold(m, "streamGenerateContent") {
			return true
		}
	}
	// Some responses omit methods; keep the model if name looks usable.
	return len(methods) == 0
}

func reverse(s []string) {
	for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
		s[i], s[j] = s[j], s[i]
	}
}
