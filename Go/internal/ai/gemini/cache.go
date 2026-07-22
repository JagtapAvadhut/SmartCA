package gemini

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

type cacheEntry struct {
	text      string
	model     string
	promptTok int
	compTok   int
	expires   time.Time
}

// ResponseCache is a short-lived in-memory cache for identical prompts.
type ResponseCache struct {
	mu    sync.RWMutex
	ttl   time.Duration
	items map[string]cacheEntry
}

func NewResponseCache(ttl time.Duration) *ResponseCache {
	if ttl <= 0 {
		ttl = 2 * time.Minute
	}
	return &ResponseCache{ttl: ttl, items: make(map[string]cacheEntry)}
}

func cacheKey(model, system string, msgs []string) string {
	h := sha256.New()
	_, _ = h.Write([]byte(model))
	_, _ = h.Write([]byte{0})
	_, _ = h.Write([]byte(system))
	for _, m := range msgs {
		_, _ = h.Write([]byte{0})
		_, _ = h.Write([]byte(m))
	}
	return hex.EncodeToString(h.Sum(nil))
}

func (c *ResponseCache) Get(key string) (cacheEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.items[key]
	if !ok || time.Now().After(e.expires) {
		return cacheEntry{}, false
	}
	return e, true
}

func (c *ResponseCache) Set(key, text, model string, promptTok, compTok int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = cacheEntry{
		text: text, model: model, promptTok: promptTok, compTok: compTok,
		expires: time.Now().Add(c.ttl),
	}
	// Opportunistic prune
	if len(c.items) > 256 {
		now := time.Now()
		for k, v := range c.items {
			if now.After(v.expires) {
				delete(c.items, k)
			}
		}
	}
}
