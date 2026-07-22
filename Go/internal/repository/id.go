package repository

import "github.com/google/uuid"

// NewUniqueID returns a globally unique record ID (UUID v7 when available, else v4).
// Used for collections where sequential counters are unsafe under concurrency
// or mixed-width legacy IDs (notably chat).
func NewUniqueID() string {
	if id, err := uuid.NewV7(); err == nil {
		return id.String()
	}
	return uuid.NewString()
}

// UsesServerUniqueIDs reports collections whose IDs must be assigned exclusively
// by the backend (never sequential counters, never client-supplied values).
func UsesServerUniqueIDs(collection string) bool {
	return collection == "chat"
}
