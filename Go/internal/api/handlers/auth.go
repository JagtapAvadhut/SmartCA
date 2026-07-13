package handlers

import (
	"net/http"

	"github.com/JagtapAvadhut/smartca-backend/internal/api/middleware"
	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/rbac"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	Auth    *services.AuthService
	Archive *services.ArchiveService
	Cfg     config.Config
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
		RememberMe bool   `json:"rememberMe"`
		Device     string `json:"device"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	res, err := h.Auth.Login(body.Identifier, body.Password, body.RememberMe, body.Device, clientIP(r))
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), res)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	_ = h.Auth.Logout(middleware.TokenFrom(r.Context()))
	apiresponse.OK(w, rid(r), map[string]string{"message": "logged out"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user := middleware.UserFrom(r.Context())
	if user == nil {
		writeErr(w, r, apperrors.Unauthorized("not authenticated"))
		return
	}
	apiresponse.OK(w, rid(r), user)
}

func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	res, err := h.Auth.ForgotPassword(body.Email)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), res)
}

func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	res, err := h.Auth.ResetPassword(body.Token, body.NewPassword)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), res)
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user := middleware.UserFrom(r.Context())
	if user == nil {
		writeErr(w, r, apperrors.Unauthorized("not authenticated"))
		return
	}
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	res, err := h.Auth.ChangePassword(user.ID(), body.CurrentPassword, body.NewPassword)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), res)
}

func (h *AuthHandler) DemoReset(w http.ResponseWriter, r *http.Request) {
	if !h.Cfg.DemoResetEnabled {
		writeErr(w, r, apperrors.Forbidden("demo reset is disabled"))
		return
	}
	user := middleware.UserFrom(r.Context())
	if !rbac.CanDemoReset(user) {
		writeErr(w, r, apperrors.Forbidden("super_admin role required"))
		return
	}
	if err := h.Archive.DemoReset(); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "demo data reset successfully"})
}
