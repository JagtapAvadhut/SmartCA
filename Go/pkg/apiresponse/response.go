package apiresponse

import (
	"encoding/json"
	"net/http"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
)

type Meta struct {
	RequestID  string      `json:"requestId"`
	Pagination *Pagination `json:"pagination,omitempty"`
}

type Pagination struct {
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	TotalItems int `json:"totalItems"`
	TotalPages int `json:"totalPages"`
}

type SuccessBody struct {
	Success bool   `json:"success"`
	Data    any    `json:"data"`
	Meta    Meta   `json:"meta"`
	Message string `json:"message,omitempty"`
}

type ErrorBody struct {
	Success bool         `json:"success"`
	Error   ErrorPayload `json:"error"`
	Meta    Meta         `json:"meta"`
}

type ErrorPayload struct {
	Code    apperrors.Code     `json:"code"`
	Message string             `json:"message"`
	Details []apperrors.Detail `json:"details,omitempty"`
}

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func OK(w http.ResponseWriter, requestID string, data any) {
	JSON(w, http.StatusOK, SuccessBody{Success: true, Data: data, Meta: Meta{RequestID: requestID}})
}

func Created(w http.ResponseWriter, requestID string, data any) {
	JSON(w, http.StatusCreated, SuccessBody{Success: true, Data: data, Meta: Meta{RequestID: requestID}})
}

func OKList(w http.ResponseWriter, requestID string, data any, page, pageSize, total int) {
	totalPages := 1
	if pageSize > 0 {
		totalPages = (total + pageSize - 1) / pageSize
		if totalPages < 1 {
			totalPages = 1
		}
	}
	JSON(w, http.StatusOK, SuccessBody{
		Success: true,
		Data:    data,
		Meta: Meta{
			RequestID: requestID,
			Pagination: &Pagination{
				Page: page, PageSize: pageSize, TotalItems: total, TotalPages: totalPages,
			},
		},
	})
}

func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

func Fail(w http.ResponseWriter, requestID string, err error) {
	ae, ok := err.(*apperrors.AppError)
	if !ok {
		ae = apperrors.Internal("unexpected server error", err)
	}
	status := ae.HTTPStatus
	if status == 0 {
		status = 500
	}
	JSON(w, status, ErrorBody{
		Success: false,
		Error: ErrorPayload{
			Code:    ae.Code,
			Message: ae.Message,
			Details: ae.Details,
		},
		Meta: Meta{RequestID: requestID},
	})
}
