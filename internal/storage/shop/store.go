package shop

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrNotFound = errors.New("not found")

type Settings struct {
	ID        int       `json:"id"`
	Currency  string    `json:"currency"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UpdateSettingsInput struct {
	Currency string
}

type Store struct {
	stmtGetSettings    *sql.Stmt
	stmtUpdateSettings *sql.Stmt
}

func NewStore(ctx context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}

	s := &Store{}
	var err error
	s.stmtGetSettings, err = db.PrepareContext(ctx, `
		SELECT id, currency, updated_at
		FROM shop_settings
		WHERE id = 1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare get settings: %w", err)
	}

	s.stmtUpdateSettings, err = db.PrepareContext(ctx, `
		UPDATE shop_settings
		SET currency = $1,
		    updated_at = now()
		WHERE id = 1
		RETURNING id, currency, updated_at
	`)
	if err != nil {
		_ = s.stmtGetSettings.Close()
		return nil, fmt.Errorf("prepare update settings: %w", err)
	}

	return s, nil
}

func (s *Store) Close() error {
	var firstErr error
	if s.stmtGetSettings != nil {
		if err := s.stmtGetSettings.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if s.stmtUpdateSettings != nil {
		if err := s.stmtUpdateSettings.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (s *Store) GetSettings(ctx context.Context) (Settings, error) {
	var out Settings
	err := s.stmtGetSettings.QueryRowContext(ctx).Scan(
		&out.ID,
		&out.Currency,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Settings{}, ErrNotFound
		}
		return Settings{}, err
	}
	return out, nil
}

func (s *Store) UpdateSettings(ctx context.Context, in UpdateSettingsInput) (Settings, error) {
	var out Settings
	err := s.stmtUpdateSettings.QueryRowContext(ctx, strings.ToUpper(strings.TrimSpace(in.Currency))).Scan(
		&out.ID,
		&out.Currency,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Settings{}, ErrNotFound
		}
		return Settings{}, err
	}
	return out, nil
}
