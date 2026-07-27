package workmgmt

import (
	"context"
	"strings"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
)

// SoftDeleteFollowUp soft-deletes a follow-up.
func (s *Service) SoftDeleteFollowUp(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.SoftDeleteFollowUp(ctx, id, actor.ID); err != nil {
		return apperrors.NotFound("follow-up not found")
	}
	return nil
}

// RestoreFollowUp restores a soft-deleted follow-up.
func (s *Service) RestoreFollowUp(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.RestoreFollowUp(ctx, id); err != nil {
		return apperrors.NotFound("follow-up not found")
	}
	return nil
}

// UpdateFollowUp updates follow-up fields.
func (s *Service) UpdateFollowUp(ctx context.Context, actor Actor, workID, id string, patch FollowUp) (*FollowUp, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, true); err != nil {
		return nil, err
	}
	list, err := s.store.ListFollowUps(ctx, workID)
	if err != nil {
		return nil, err
	}
	var found *FollowUp
	for i := range list {
		if list[i].ID == id {
			found = &list[i]
			break
		}
	}
	if found == nil {
		return nil, apperrors.NotFound("follow-up not found")
	}
	oldNotes := found.Notes
	if patch.FollowUpDate != "" {
		found.FollowUpDate = patch.FollowUpDate
	}
	if patch.FollowUpTime != "" {
		found.FollowUpTime = patch.FollowUpTime
	}
	if patch.Notes != "" {
		found.Notes = patch.Notes
	}
	if patch.NextFollowUpDate != "" {
		found.NextFollowUpDate = patch.NextFollowUpDate
	}
	found.Reminder = patch.Reminder
	if err := s.store.UpdateFollowUp(ctx, found); err != nil {
		return nil, apperrors.Internal("failed to update follow-up", err)
	}
	s.auditField(ctx, actor, workID, "followup", id, "notes", oldNotes, found.Notes)
	s.activity(ctx, actor, workID, ActionFollowUp, "Follow-up updated", map[string]any{"followUpId": id})
	return found, nil
}

// SoftDeleteCall soft-deletes a call log.
func (s *Service) SoftDeleteCall(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.SoftDeleteCall(ctx, id, actor.ID); err != nil {
		return apperrors.NotFound("call not found")
	}
	return nil
}

// RestoreCall restores a soft-deleted call log.
func (s *Service) RestoreCall(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.RestoreCall(ctx, id); err != nil {
		return apperrors.NotFound("call not found")
	}
	return nil
}

// SoftDeleteEmail soft-deletes an email log.
func (s *Service) SoftDeleteEmail(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.SoftDeleteEmail(ctx, id, actor.ID); err != nil {
		return apperrors.NotFound("email not found")
	}
	return nil
}

// RestoreEmail restores a soft-deleted email log.
func (s *Service) RestoreEmail(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.RestoreEmail(ctx, id); err != nil {
		return apperrors.NotFound("email not found")
	}
	return nil
}

// SoftDeleteMeeting soft-deletes a meeting.
func (s *Service) SoftDeleteMeeting(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.SoftDeleteMeeting(ctx, id, actor.ID); err != nil {
		return apperrors.NotFound("meeting not found")
	}
	return nil
}

// RestoreMeeting restores a soft-deleted meeting.
func (s *Service) RestoreMeeting(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.RestoreMeeting(ctx, id); err != nil {
		return apperrors.NotFound("meeting not found")
	}
	return nil
}

// SoftDeleteNote soft-deletes a note.
func (s *Service) SoftDeleteNote(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.SoftDeleteNote(ctx, id, actor.ID); err != nil {
		return apperrors.NotFound("note not found")
	}
	return nil
}

// RestoreNote restores a soft-deleted note.
func (s *Service) RestoreNote(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermEdit); err != nil {
		return err
	}
	if err := s.store.RestoreNote(ctx, id); err != nil {
		return apperrors.NotFound("note not found")
	}
	return nil
}

// SoftDeleteComment soft-deletes a comment.
func (s *Service) SoftDeleteComment(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermComment); err != nil {
		return err
	}
	if err := s.store.SoftDeleteComment(ctx, id, actor.ID); err != nil {
		return apperrors.NotFound("comment not found")
	}
	return nil
}

// RestoreComment restores a soft-deleted comment.
func (s *Service) RestoreComment(ctx context.Context, actor Actor, id string) error {
	if err := s.require(actor, PermComment); err != nil {
		return err
	}
	if err := s.store.RestoreComment(ctx, id); err != nil {
		return apperrors.NotFound("comment not found")
	}
	return nil
}

// UpdateNoteBody updates a note with edit history timestamp.
func (s *Service) UpdateNoteBody(ctx context.Context, actor Actor, id, body string) (*Note, error) {
	if err := s.require(actor, PermEdit); err != nil {
		return nil, err
	}
	_ = id
	_ = body
	return nil, apperrors.BadRequest("use UpdateNoteOnWork")
}

// UpdateNoteOnWork updates note content.
func (s *Service) UpdateNoteOnWork(ctx context.Context, actor Actor, workID, noteID, body string) (*Note, error) {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, true); err != nil {
		return nil, err
	}
	notes, err := s.store.ListNotes(ctx, workID)
	if err != nil {
		return nil, err
	}
	var found *Note
	for i := range notes {
		if notes[i].ID == noteID {
			found = &notes[i]
			break
		}
	}
	if found == nil {
		return nil, apperrors.NotFound("note not found")
	}
	old := found.Body
	found.Body = body
	if err := s.store.UpdateNote(ctx, found); err != nil {
		return nil, apperrors.Internal("failed to update note", err)
	}
	s.auditField(ctx, actor, workID, "note", noteID, "body", old, body)
	s.activity(ctx, actor, workID, ActionNote, "Note updated", nil)
	return found, nil
}

// CancelMeeting marks meeting cancelled via discussion notes prefix (soft semantic).
func (s *Service) CancelMeeting(ctx context.Context, actor Actor, workID, meetingID string) error {
	if _, err := s.ensureWorkAccess(ctx, actor, workID, true); err != nil {
		return err
	}
	meetings, err := s.store.ListMeetings(ctx, workID)
	if err != nil {
		return err
	}
	for _, m := range meetings {
		if m.ID == meetingID {
			if strings.HasPrefix(m.DiscussionNotes, "[CANCELLED]") {
				return nil
			}
			// Soft-delete acts as cancel+archive
			if err := s.store.SoftDeleteMeeting(ctx, meetingID, actor.ID); err != nil {
				return err
			}
			s.activity(ctx, actor, workID, ActionMeeting, "Meeting cancelled", map[string]any{"meetingId": meetingID})
			s.auditField(ctx, actor, workID, "meeting", meetingID, "status", "active", "cancelled")
			return nil
		}
	}
	return apperrors.NotFound("meeting not found")
}
