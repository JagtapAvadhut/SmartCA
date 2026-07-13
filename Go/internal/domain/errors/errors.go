package errors

import "fmt"

type Code string

const (
	CodeValidation   Code = "VALIDATION_ERROR"
	CodeUnauthorized Code = "UNAUTHORIZED"
	CodeForbidden    Code = "FORBIDDEN"
	CodeNotFound     Code = "NOT_FOUND"
	CodeConflict     Code = "CONFLICT"
	CodeBadRequest   Code = "BAD_REQUEST"
	CodeInternal     Code = "INTERNAL_ERROR"
)

type Detail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type AppError struct {
	Code       Code
	Message    string
	Details    []Detail
	HTTPStatus int
	Err        error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error { return e.Err }

func New(code Code, status int, message string) *AppError {
	return &AppError{Code: code, HTTPStatus: status, Message: message}
}

func Validation(message string, details ...Detail) *AppError {
	return &AppError{Code: CodeValidation, HTTPStatus: 400, Message: message, Details: details}
}

func Unauthorized(message string) *AppError {
	return New(CodeUnauthorized, 401, message)
}

func Forbidden(message string) *AppError {
	return New(CodeForbidden, 403, message)
}

func NotFound(message string) *AppError {
	return New(CodeNotFound, 404, message)
}

func Conflict(message string) *AppError {
	return New(CodeConflict, 409, message)
}

func BadRequest(message string) *AppError {
	return New(CodeBadRequest, 400, message)
}

func Internal(message string, err error) *AppError {
	return &AppError{Code: CodeInternal, HTTPStatus: 500, Message: message, Err: err}
}
