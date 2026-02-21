package shipping

import (
	"context"
	"database/sql"
	"errors"
)

type Store struct {
	db *sql.DB
}

func NewStore(_ context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	return &Store{db: db}, nil
}

func (s *Store) CreateProvider(ctx context.Context, key, name string, mode string, configJSON []byte) error {
	if key == "" || name == "" {
		return errors.New("key and name are required")
	}
	if mode == "" {
		mode = "sandbox"
	}
	if configJSON == nil {
		configJSON = []byte("{}")
	}

	_, err := s.db.ExecContext(
		ctx,
		"INSERT INTO shipping_providers (key, name, mode, config_json) VALUES ($1, $2, $3, $4)",
		key, name, mode, configJSON,
	)
	return err
}

func (s *Store) UpdateProvider(ctx context.Context, key string, enabled bool, mode string, configJSON []byte) error {
	if key == "" {
		return errors.New("key is required")
	}
	if mode == "" {
		mode = "sandbox"
	}
	if configJSON == nil {
		configJSON = []byte("{}")
	}

	result, err := s.db.ExecContext(
		ctx,
		"UPDATE shipping_providers SET enabled = $1, mode = $2, config_json = $3, updated_at = now() WHERE key = $4",
		enabled, mode, configJSON, key,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) GetProvider(ctx context.Context, key string) (*Provider, error) {
	if key == "" {
		return nil, errors.New("key is required")
	}

	var p Provider
	err := s.db.QueryRowContext(
		ctx,
		"SELECT id, key, name, enabled, mode, config_json, created_at, updated_at FROM shipping_providers WHERE key = $1",
		key,
	).Scan(&p.ID, &p.Key, &p.Name, &p.Enabled, &p.Mode, &p.ConfigJSON, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}

	return &p, nil
}

func (s *Store) ListProviders(ctx context.Context) ([]Provider, error) {
	rows, err := s.db.QueryContext(
		ctx,
		"SELECT id, key, name, enabled, mode, config_json, created_at, updated_at FROM shipping_providers ORDER BY created_at DESC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var providers []Provider
	for rows.Next() {
		var p Provider
		if err := rows.Scan(&p.ID, &p.Key, &p.Name, &p.Enabled, &p.Mode, &p.ConfigJSON, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		providers = append(providers, p)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return providers, nil
}

func (s *Store) DeleteProvider(ctx context.Context, key string) error {
	if key == "" {
		return errors.New("key is required")
	}

	result, err := s.db.ExecContext(
		ctx,
		"DELETE FROM shipping_providers WHERE key = $1",
		key,
	)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}
