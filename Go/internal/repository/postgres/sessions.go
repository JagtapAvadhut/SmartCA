package postgres

import (
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

func (s *Store) CreateSession(sess repository.Session) repository.Session {
	if sess.ID == "" {
		sess.ID = fmt.Sprintf("SES-%s", strconv.FormatInt(time.Now().UnixNano(), 36))
	}
	if sess.CreatedAt.IsZero() {
		sess.CreatedAt = time.Now().UTC()
	}
	_, err := s.q().Exec(
		`INSERT INTO auth_sessions (id, user_id, token, device, ip, active, created_at, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT (id) DO UPDATE SET
		   token = EXCLUDED.token,
		   device = EXCLUDED.device,
		   ip = EXCLUDED.ip,
		   active = EXCLUDED.active,
		   expires_at = EXCLUDED.expires_at`,
		sess.ID, sess.UserID, sess.Token, sess.Device, sess.IP, sess.Active, sess.CreatedAt, sess.ExpiresAt,
	)
	if err != nil {
		return sess
	}
	return sess
}

func (s *Store) GetSession(id string) (repository.Session, bool) {
	row := s.q().QueryRow(
		`SELECT id, user_id, token, COALESCE(device,''), COALESCE(ip,''), active, created_at, expires_at
		 FROM auth_sessions WHERE id = $1`, id,
	)
	var sess repository.Session
	if err := row.Scan(&sess.ID, &sess.UserID, &sess.Token, &sess.Device, &sess.IP, &sess.Active, &sess.CreatedAt, &sess.ExpiresAt); err != nil {
		return repository.Session{}, false
	}
	return sess, true
}

func (s *Store) RevokeSession(id string) {
	_, _ = s.q().Exec(`UPDATE auth_sessions SET active = FALSE WHERE id = $1`, id)
}

func (s *Store) RevokeUserSessions(userID string) {
	_, _ = s.q().Exec(`UPDATE auth_sessions SET active = FALSE WHERE user_id = $1`, userID)
}

func (s *Store) ClearSessions() {
	_, _ = s.q().Exec(`DELETE FROM auth_sessions`)
}

func (s *Store) FindSessionByToken(token string) (repository.Session, bool) {
	if token == "" {
		return repository.Session{}, false
	}
	const q = `SELECT id, user_id, token, COALESCE(device,''), COALESCE(ip,''), active, created_at, expires_at
		 FROM auth_sessions
		 WHERE token = $1 AND active = TRUE AND expires_at > NOW()`
	var sess repository.Session
	err := s.q().QueryRow(q, token).Scan(
		&sess.ID, &sess.UserID, &sess.Token, &sess.Device, &sess.IP, &sess.Active, &sess.CreatedAt, &sess.ExpiresAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return repository.Session{}, false
		}
		// Transient pool/connection errors: retry once.
		err2 := s.q().QueryRow(q, token).Scan(
			&sess.ID, &sess.UserID, &sess.Token, &sess.Device, &sess.IP, &sess.Active, &sess.CreatedAt, &sess.ExpiresAt,
		)
		if err2 != nil {
			return repository.Session{}, false
		}
	}
	return sess, true
}

func (s *Store) RevokeSessionByToken(token string) {
	if token == "" {
		return
	}
	_, _ = s.q().Exec(`UPDATE auth_sessions SET active = FALSE WHERE token = $1`, token)
}
