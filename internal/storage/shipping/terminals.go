package shipping

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

func (s *Store) GetCachedTerminals(ctx context.Context, providerKey, country string) ([]byte, time.Time, error) {
	if providerKey == "" || country == "" {
		return nil, time.Time{}, errors.New("provider_key and country are required")
	}

	var payload []byte
	var fetchedAt time.Time
	err := s.db.QueryRowContext(
		ctx,
		"SELECT payload_json, fetched_at FROM shipping_terminals_cache WHERE provider_key = $1 AND country = $2",
		providerKey, country,
	).Scan(&payload, &fetchedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, time.Time{}, sql.ErrNoRows
		}
		return nil, time.Time{}, err
	}

	return payload, fetchedAt, nil
}

func (s *Store) UpsertCachedTerminals(ctx context.Context, providerKey, country string, payloadJSON []byte) error {
	if providerKey == "" || country == "" {
		return errors.New("provider_key and country are required")
	}
	if payloadJSON == nil {
		payloadJSON = []byte("[]")
	}

	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO shipping_terminals_cache (provider_key, country, payload_json, fetched_at)
		 VALUES ($1, $2, $3, now())
		 ON CONFLICT (provider_key, country) DO UPDATE SET
		   payload_json = EXCLUDED.payload_json,
		   fetched_at = now()`,
		providerKey, country, payloadJSON,
	)
	return err
}

func (s *Store) DeleteCachedTerminals(ctx context.Context, providerKey, country string) error {
	if providerKey == "" || country == "" {
		return errors.New("provider_key and country are required")
	}

	result, err := s.db.ExecContext(
		ctx,
		"DELETE FROM shipping_terminals_cache WHERE provider_key = $1 AND country = $2",
		providerKey, country,
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
