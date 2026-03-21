package shipping

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

func (s *Store) CreateZone(ctx context.Context, name string, countriesJSON []byte) (string, error) {
	if name == "" {
		return "", errors.New("name is required")
	}
	if countriesJSON == nil {
		countriesJSON = []byte("[]")
	}

	var id string
	err := s.db.QueryRowContext(
		ctx,
		"INSERT INTO shipping_zones (name, countries_json) VALUES ($1, $2) RETURNING id",
		name, countriesJSON,
	).Scan(&id)

	return id, err
}

func (s *Store) UpdateZone(ctx context.Context, id string, name string, countriesJSON []byte, enabled bool) error {
	if id == "" {
		return errors.New("id is required")
	}
	if name == "" {
		return errors.New("name is required")
	}
	if countriesJSON == nil {
		countriesJSON = []byte("[]")
	}

	result, err := s.db.ExecContext(
		ctx,
		"UPDATE shipping_zones SET name = $1, countries_json = $2, enabled = $3, updated_at = now() WHERE id = $4",
		name, countriesJSON, enabled, id,
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

func (s *Store) GetZone(ctx context.Context, id string) (*Zone, error) {
	if id == "" {
		return nil, errors.New("id is required")
	}

	var z Zone
	err := s.db.QueryRowContext(
		ctx,
		"SELECT id, name, countries_json, enabled, created_at, updated_at FROM shipping_zones WHERE id = $1",
		id,
	).Scan(&z.ID, &z.Name, &z.CountriesJSON, &z.Enabled, &z.CreatedAt, &z.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}

	return &z, nil
}

func (s *Store) ListZones(ctx context.Context) ([]Zone, error) {
	rows, err := s.db.QueryContext(
		ctx,
		"SELECT id, name, countries_json, enabled, created_at, updated_at FROM shipping_zones ORDER BY created_at DESC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var zones []Zone
	for rows.Next() {
		var z Zone
		if err := rows.Scan(&z.ID, &z.Name, &z.CountriesJSON, &z.Enabled, &z.CreatedAt, &z.UpdatedAt); err != nil {
			return nil, err
		}
		zones = append(zones, z)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return zones, nil
}

func (s *Store) DeleteZone(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("id is required")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Nullify FK references in orders for methods belonging to this zone,
	// then cascade-delete will handle the methods themselves.
	if _, err := tx.ExecContext(ctx,
		"UPDATE orders SET shipping_method_id = NULL WHERE shipping_method_id IN (SELECT id FROM shipping_methods WHERE zone_id = $1)", id,
	); err != nil {
		return fmt.Errorf("nullify order references: %w", err)
	}

	result, err := tx.ExecContext(ctx, "DELETE FROM shipping_zones WHERE id = $1", id)
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
	return tx.Commit()
}

func (s *Store) GetZoneByCountry(ctx context.Context, country string) (*Zone, error) {
	if country == "" {
		return nil, errors.New("country is required")
	}

	var z Zone
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, name, countries_json, enabled, created_at, updated_at 
		 FROM shipping_zones 
		 WHERE enabled = true AND countries_json @> jsonb_build_array($1::text)`,
		country,
	).Scan(&z.ID, &z.Name, &z.CountriesJSON, &z.Enabled, &z.CreatedAt, &z.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}

	return &z, nil
}
