package auth

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

// Session is an opaque server-side login session.
type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Token     string    `json:"token"`
	Device    string    `json:"device"`
	IP        string    `json:"ip"`
	CreatedAt time.Time `json:"createdAt"`
	ExpiresAt time.Time `json:"expiresAt"`
	Active    bool      `json:"active"`
}

// NewOpaqueToken returns a cryptographically random hex token.
func NewOpaqueToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// NewSessionID returns a random session identifier.
func NewSessionID() (string, error) {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "SES-" + hex.EncodeToString(buf), nil
}

// NewSession builds an active session with the given TTL.
func NewSession(userID, device, ip string, ttl time.Duration) (Session, error) {
	token, err := NewOpaqueToken()
	if err != nil {
		return Session{}, err
	}
	id, err := NewSessionID()
	if err != nil {
		return Session{}, err
	}
	now := time.Now().UTC()
	return Session{
		ID:        id,
		UserID:    userID,
		Token:     token,
		Device:    device,
		IP:        ip,
		CreatedAt: now,
		ExpiresAt: now.Add(ttl),
		Active:    true,
	}, nil
}

// Expired reports whether the session is past its expiry.
func (s Session) Expired(now time.Time) bool {
	return !s.Active || now.After(s.ExpiresAt)
}
