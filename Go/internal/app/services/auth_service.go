package services

import (
	"strings"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/auth"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

// AuthService handles login, logout, and password flows.
type AuthService struct {
	store repository.Store
	cfg   config.Config
	nowFn func() time.Time
}

func NewAuthService(store repository.Store, cfg config.Config) *AuthService {
	return &AuthService{store: store, cfg: cfg, nowFn: time.Now}
}

// LoginResult is returned on successful authentication.
type LoginResult struct {
	User    models.Record `json:"user"`
	Token   string        `json:"token"`
	Session auth.Session  `json:"session"`
}

// Login authenticates by email|username|loginId (case-insensitive).
func (s *AuthService) Login(identifier, password string, rememberMe bool, device, ip string) (*LoginResult, error) {
	id := strings.ToLower(strings.TrimSpace(identifier))
	if id == "" || password == "" {
		return nil, apperrors.Validation("identifier and password are required")
	}
	if device == "" {
		device = "Desktop Browser"
	}
	if ip == "" {
		ip = "127.0.0.1"
	}

	users := s.store.GetAll(ColUsers, true)
	var user models.Record
	for _, u := range users {
		if strings.EqualFold(u.GetString("email"), id) ||
			strings.EqualFold(u.GetString("username"), id) ||
			strings.EqualFold(u.GetString("loginId"), id) {
			user = u
			break
		}
	}
	if user == nil {
		return nil, apperrors.Unauthorized("Invalid email, username, or login ID")
	}
	if !strings.EqualFold(user.GetString("status"), "active") {
		return nil, apperrors.Forbidden("Your account has been deactivated. Contact administrator.")
	}
	hash := user.GetString("passwordHash")
	switch {
	case hash != "":
		if !auth.ComparePassword(hash, password) {
			return nil, apperrors.Unauthorized("Incorrect password")
		}
	case user.GetString("password") == password:
		// legacy plaintext seed fallback
	default:
		return nil, apperrors.Unauthorized("Incorrect password")
	}

	ttl := s.cfg.SessionTTL
	if rememberMe {
		ttl = 7 * 24 * time.Hour
	}
	sess, err := auth.NewSession(user.ID(), device, ip, ttl)
	if err != nil {
		return nil, apperrors.Internal("failed to create session", err)
	}
	memSess := repository.Session{
		ID: sess.ID, UserID: sess.UserID, Token: sess.Token,
		Device: sess.Device, IP: sess.IP,
		CreatedAt: sess.CreatedAt, ExpiresAt: sess.ExpiresAt, Active: true,
	}
	memSess = s.store.CreateSession(memSess)
	sess.ID = memSess.ID

	now := s.nowFn().UTC().Format(time.RFC3339)
	_, _ = s.store.Update(ColUsers, user.ID(), models.Record{"lastLogin": now})
	_, _ = s.store.Create(ColLoginHistory, models.Record{
		"userId":    user.ID(),
		"userName":  user.GetString("fullName"),
		"email":     user.GetString("email"),
		"success":   true,
		"ip":        ip,
		"device":    device,
		"timestamp": now,
	})
	_, _ = s.store.Create(ColActivities, models.Record{
		"type":       "login",
		"message":    user.GetString("fullName") + " logged in",
		"clientId":   "",
		"clientName": "",
		"userId":     user.ID(),
		"userName":   user.GetString("fullName"),
		"timestamp":  now,
	})

	return &LoginResult{
		User:    sanitizeUser(user),
		Token:   sess.Token,
		Session: sess,
	}, nil
}

// Logout revokes the bearer session.
func (s *AuthService) Logout(token string) error {
	s.store.RevokeSessionByToken(token)
	return nil
}

// Me returns the sanitized user for a valid session token.
func (s *AuthService) Me(token string) (models.Record, error) {
	sess, ok := s.store.FindSessionByToken(token)
	if !ok {
		return nil, apperrors.Unauthorized("invalid or expired session")
	}
	user, err := s.store.Get(ColUsers, sess.UserID)
	if err != nil {
		return nil, apperrors.Unauthorized("user not found")
	}
	return sanitizeUser(user), nil
}

// UserFromSession loads the user attached to a store session.
func (s *AuthService) UserFromSession(sess repository.Session) (models.Record, error) {
	user, err := s.store.Get(ColUsers, sess.UserID)
	if err != nil {
		return nil, apperrors.Unauthorized("user not found")
	}
	if !strings.EqualFold(user.GetString("status"), "active") {
		return nil, apperrors.Forbidden("account deactivated")
	}
	return sanitizeUser(user), nil
}

// ForgotPassword demo stub — does not send email.
func (s *AuthService) ForgotPassword(email string) (map[string]string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, apperrors.Validation("email is required")
	}
	found := false
	for _, u := range s.store.GetAll(ColUsers, false) {
		if strings.EqualFold(u.GetString("email"), email) {
			found = true
			break
		}
	}
	if !found {
		return nil, apperrors.NotFound("No account found with this email address")
	}
	return map[string]string{"message": "Password reset link has been sent to your email address."}, nil
}

// ResetPassword demo stub.
func (s *AuthService) ResetPassword(_token, newPassword string) (map[string]string, error) {
	if len(newPassword) < 8 {
		return nil, apperrors.Validation("Password must be at least 8 characters")
	}
	return map[string]string{"message": "Password has been reset successfully. You can now sign in."}, nil
}

// ChangePassword updates passwordHash after verifying the current password.
func (s *AuthService) ChangePassword(userID, currentPassword, newPassword string) (map[string]string, error) {
	if len(newPassword) < 8 {
		return nil, apperrors.Validation("New password must be at least 8 characters")
	}
	user, err := s.store.Get(ColUsers, userID)
	if err != nil {
		return nil, err
	}
	hash := user.GetString("passwordHash")
	if !auth.ComparePassword(hash, currentPassword) {
		return nil, apperrors.Unauthorized("Current password is incorrect")
	}
	newHash, err := auth.HashPassword(newPassword)
	if err != nil {
		return nil, apperrors.Internal("failed to hash password", err)
	}
	_, err = s.store.Update(ColUsers, userID, models.Record{"passwordHash": newHash})
	if err != nil {
		return nil, err
	}
	return map[string]string{"message": "Password changed successfully"}, nil
}

func sanitizeUser(user models.Record) models.Record {
	out := user.Clone()
	delete(out, "password")
	delete(out, "passwordHash")
	return out
}
