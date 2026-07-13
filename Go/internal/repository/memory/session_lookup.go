package memory

import "time"

// FindSessionByToken returns the active session matching the opaque bearer token.
func (s *Store) FindSessionByToken(token string) (Session, bool) {
	if token == "" {
		return Session{}, false
	}
	s.lockRead()
	defer s.unlockRead()
	now := time.Now().UTC()
	for _, sess := range s.sessions {
		if sess.Token != token {
			continue
		}
		if !sess.Active || now.After(sess.ExpiresAt) {
			return Session{}, false
		}
		return sess, true
	}
	return Session{}, false
}

// RevokeSessionByToken deactivates the session that owns the token.
func (s *Store) RevokeSessionByToken(token string) {
	if token == "" {
		return
	}
	s.lockWrite()
	defer s.unlockWrite()
	for id, sess := range s.sessions {
		if sess.Token == token {
			sess.Active = false
			s.sessions[id] = sess
			return
		}
	}
}
