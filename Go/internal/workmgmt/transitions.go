package workmgmt

import (
	"strings"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
)

// Practice status constants (Architecture §6.1).
const (
	StatusOpen                 = "OPEN"
	StatusDocumentPending      = "DOCUMENT_PENDING"
	StatusDocumentReceived     = "DOCUMENT_RECEIVED"
	StatusInProgress           = "IN_PROGRESS"
	StatusBlocked              = "BLOCKED"
	StatusOnHold               = "ON_HOLD"
	StatusReadyForTLVerify     = "READY_FOR_TL_VERIFY"
	StatusTLRejected           = "TL_REJECTED"
	StatusTLVerified           = "TL_VERIFIED"
	StatusReadyForCAVerify     = "READY_FOR_CA_VERIFY"
	StatusCARejected           = "CA_REJECTED"
	StatusCAVerified           = "CA_VERIFIED"
	StatusReadyForManagerClose = "READY_FOR_MANAGER_CLOSE"
	StatusDelivered            = "DELIVERED"
	StatusClosed               = "CLOSED"
	StatusCancelled            = "CANCELLED"
)

// Risk classes.
const (
	RiskLow    = "low"
	RiskMedium = "medium"
	RiskHigh   = "high"
)

// Overlay starter set (v1).
const (
	OverlayGSTR1Filed     = "GSTR1_FILED"
	OverlayGSTR3BFiled    = "GSTR3B_FILED"
	OverlayITRUnderReview = "ITR_UNDER_REVIEW"
	OverlayNoticeReplyDue = "NOTICE_REPLY_DUE"
)

// NormalizePracticeStatus maps legacy task statuses and practice codes to canonical practice status.
func NormalizePracticeStatus(st string) string {
	s := strings.ToUpper(strings.TrimSpace(st))
	// legacy lowercase
	switch strings.ToLower(strings.TrimSpace(st)) {
	case "todo":
		return StatusOpen
	case "in_progress":
		return StatusInProgress
	case "blocked":
		return StatusBlocked
	case "review":
		return StatusReadyForTLVerify
	case "completed":
		return StatusClosed
	case "cancelled":
		return StatusCancelled
	}
	switch s {
	case StatusOpen, StatusDocumentPending, StatusDocumentReceived, StatusInProgress,
		StatusBlocked, StatusOnHold, StatusReadyForTLVerify, StatusTLRejected, StatusTLVerified,
		StatusReadyForCAVerify, StatusCARejected, StatusCAVerified, StatusReadyForManagerClose,
		StatusDelivered, StatusClosed, StatusCancelled:
		return s
	case "":
		return StatusOpen
	default:
		return StatusOpen
	}
}

// IsTerminalStatus reports CLOSED / CANCELLED.
func IsTerminalStatus(st string) bool {
	s := NormalizePracticeStatus(st)
	return s == StatusClosed || s == StatusCancelled
}

// IsClosedLike reports CLOSED/DELIVERED (delivery-complete). Dashboard completed uses CLOSED only.
func IsClosedLike(st string) bool {
	s := NormalizePracticeStatus(st)
	return s == StatusClosed || s == StatusDelivered
}

// freePatchStatuses are non-gate operational moves allowed via PATCH (Architecture: gates use dedicated APIs).
var freePatchStatuses = map[string]bool{
	StatusOpen:             true,
	StatusDocumentPending:  true,
	StatusDocumentReceived: true,
	StatusInProgress:       true,
	StatusBlocked:          true,
	StatusOnHold:           true,
	StatusTLRejected:       true,
	StatusCARejected:       true,
}

// gatedStatuses must not be set via PATCH.
var gatedStatuses = map[string]bool{
	StatusReadyForTLVerify:     true,
	StatusTLVerified:           true,
	StatusReadyForCAVerify:     true,
	StatusCAVerified:           true,
	StatusReadyForManagerClose: true,
	StatusDelivered:            true,
	StatusClosed:               true,
	StatusCancelled:            true,
}

// AssertFreeStatusPatch rejects gate/complete status changes on PATCH.
func AssertFreeStatusPatch(to string) error {
	s := NormalizePracticeStatus(to)
	if gatedStatuses[s] {
		return apperrors.Conflict("practice_status gate transitions require /transitions, /verify/*, /close, or /reopen APIs")
	}
	if !freePatchStatuses[s] {
		return apperrors.Validation("invalid practice status for PATCH: " + s)
	}
	return nil
}

// legalEdges defines allowed non-verify transitions (to → from set).
var legalEdges = map[string]map[string]bool{
	StatusDocumentPending: {
		StatusOpen: true, StatusDocumentReceived: true, StatusInProgress: true,
	},
	StatusDocumentReceived: {
		StatusDocumentPending: true, StatusInProgress: true,
	},
	StatusInProgress: {
		StatusOpen: true, StatusDocumentReceived: true, StatusDocumentPending: true,
		StatusBlocked: true, StatusOnHold: true, StatusTLRejected: true, StatusCARejected: true,
	},
	StatusBlocked: {
		StatusInProgress: true, StatusOpen: true, StatusDocumentPending: true,
	},
	StatusOnHold: {
		StatusInProgress: true, StatusOpen: true,
	},
	StatusReadyForTLVerify: {
		StatusInProgress: true, StatusDocumentReceived: true, StatusTLRejected: true,
	},
	StatusCancelled: {
		StatusOpen: true, StatusDocumentPending: true, StatusInProgress: true,
		StatusBlocked: true, StatusOnHold: true,
	},
}

// CanTransition reports whether from→to is a legal non-verify edge.
func CanTransition(from, to string) bool {
	f, t := NormalizePracticeStatus(from), NormalizePracticeStatus(to)
	if f == t {
		return true
	}
	allowed, ok := legalEdges[t]
	if !ok {
		return false
	}
	return allowed[f]
}

// TransitionResult is the outcome of a verify/close decision.
type TransitionResult struct {
	From   string
	To     string
	Notify string // user id hint (slot name)
}

// ApplyTLVerify returns next status for TL pass/fail.
func ApplyTLVerify(from string, pass bool) (string, error) {
	f := NormalizePracticeStatus(from)
	if f != StatusReadyForTLVerify {
		return "", apperrors.Conflict("TL verify requires READY_FOR_TL_VERIFY")
	}
	if pass {
		// TL_VERIFIED is transient → READY_FOR_CA_VERIFY
		return StatusReadyForCAVerify, nil
	}
	return StatusTLRejected, nil
}

// ApplyCAVerify returns next status for CA pass/fail given risk + delegated_close.
func ApplyCAVerify(from, risk string, delegatedClose bool, pass bool) (string, error) {
	f := NormalizePracticeStatus(from)
	if f != StatusReadyForCAVerify {
		return "", apperrors.Conflict("CA verify requires READY_FOR_CA_VERIFY")
	}
	if !pass {
		return StatusCARejected, nil
	}
	r := strings.ToLower(strings.TrimSpace(risk))
	if r == "" {
		r = RiskMedium
	}
	if r == RiskLow && delegatedClose {
		return StatusDelivered, nil
	}
	if r == RiskLow {
		return StatusDelivered, nil
	}
	return StatusReadyForManagerClose, nil
}

// ApplyClose returns CLOSED from manager/partner close queue or delivered.
func ApplyClose(from string) (string, error) {
	f := NormalizePracticeStatus(from)
	switch f {
	case StatusReadyForManagerClose, StatusDelivered, StatusCAVerified:
		return StatusClosed, nil
	default:
		return "", apperrors.Conflict("close requires READY_FOR_MANAGER_CLOSE or DELIVERED")
	}
}

// ApplyReopen returns OPEN from CLOSED.
func ApplyReopen(from string) (string, error) {
	if NormalizePracticeStatus(from) != StatusClosed {
		return "", apperrors.Conflict("reopen requires CLOSED")
	}
	return StatusOpen, nil
}

// NormalizeRiskClass normalizes risk.
func NormalizeRiskClass(r string) string {
	switch strings.ToLower(strings.TrimSpace(r)) {
	case RiskLow, RiskMedium, RiskHigh:
		return strings.ToLower(strings.TrimSpace(r))
	default:
		return RiskMedium
	}
}

// NormalizeOverlay validates starter overlays (empty allowed).
func NormalizeOverlay(o string) string {
	o = strings.ToUpper(strings.TrimSpace(o))
	switch o {
	case "", OverlayGSTR1Filed, OverlayGSTR3BFiled, OverlayITRUnderReview, OverlayNoticeReplyDue:
		return o
	default:
		return o // allow forward-compat custom overlays
	}
}
