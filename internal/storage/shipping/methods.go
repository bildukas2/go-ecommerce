package shipping

import (
	"context"
	"database/sql"
	"errors"
)

func (s *Store) CreateMethod(ctx context.Context, method Method) (string, error) {
	if method.ZoneID == "" {
		return "", errors.New("zone_id is required")
	}
	if method.ProviderKey == "" {
		return "", errors.New("provider_key is required")
	}
	if method.ServiceCode == "" {
		return "", errors.New("service_code is required")
	}
	if method.Title == "" {
		return "", errors.New("title is required")
	}
	if method.PricingMode == "" {
		method.PricingMode = "fixed"
	}
	if method.PricingRulesJSON == nil {
		method.PricingRulesJSON = []byte("{}")
	}

	var id string
	err := s.db.QueryRowContext(
		ctx,
		`INSERT INTO shipping_methods (zone_id, provider_key, service_code, title, enabled, sort_order, pricing_mode, pricing_rules_json) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
		 RETURNING id`,
		method.ZoneID, method.ProviderKey, method.ServiceCode, method.Title, method.Enabled, method.SortOrder, method.PricingMode, method.PricingRulesJSON,
	).Scan(&id)

	return id, err
}

func (s *Store) UpdateMethod(ctx context.Context, method Method) error {
	if method.ID == "" {
		return errors.New("id is required")
	}
	if method.ZoneID == "" {
		return errors.New("zone_id is required")
	}
	if method.ProviderKey == "" {
		return errors.New("provider_key is required")
	}
	if method.ServiceCode == "" {
		return errors.New("service_code is required")
	}
	if method.Title == "" {
		return errors.New("title is required")
	}
	if method.PricingMode == "" {
		method.PricingMode = "fixed"
	}
	if method.PricingRulesJSON == nil {
		method.PricingRulesJSON = []byte("{}")
	}

	result, err := s.db.ExecContext(
		ctx,
		`UPDATE shipping_methods 
		 SET zone_id = $1, provider_key = $2, service_code = $3, title = $4, enabled = $5, sort_order = $6, pricing_mode = $7, pricing_rules_json = $8, updated_at = now() 
		 WHERE id = $9`,
		method.ZoneID, method.ProviderKey, method.ServiceCode, method.Title, method.Enabled, method.SortOrder, method.PricingMode, method.PricingRulesJSON, method.ID,
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

func (s *Store) GetMethod(ctx context.Context, id string) (*Method, error) {
	if id == "" {
		return nil, errors.New("id is required")
	}

	var m Method
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, zone_id, provider_key, service_code, title, enabled, sort_order, pricing_mode, pricing_rules_json, created_at, updated_at 
		 FROM shipping_methods 
		 WHERE id = $1`,
		id,
	).Scan(&m.ID, &m.ZoneID, &m.ProviderKey, &m.ServiceCode, &m.Title, &m.Enabled, &m.SortOrder, &m.PricingMode, &m.PricingRulesJSON, &m.CreatedAt, &m.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}

	return &m, nil
}

func (s *Store) ListMethods(ctx context.Context) ([]Method, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, zone_id, provider_key, service_code, title, enabled, sort_order, pricing_mode, pricing_rules_json, created_at, updated_at 
		 FROM shipping_methods 
		 ORDER BY sort_order ASC, created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var methods []Method
	for rows.Next() {
		var m Method
		if err := rows.Scan(&m.ID, &m.ZoneID, &m.ProviderKey, &m.ServiceCode, &m.Title, &m.Enabled, &m.SortOrder, &m.PricingMode, &m.PricingRulesJSON, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		methods = append(methods, m)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return methods, nil
}

func (s *Store) ListMethodsByZone(ctx context.Context, zoneID string) ([]Method, error) {
	if zoneID == "" {
		return nil, errors.New("zone_id is required")
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, zone_id, provider_key, service_code, title, enabled, sort_order, pricing_mode, pricing_rules_json, created_at, updated_at 
		 FROM shipping_methods 
		 WHERE zone_id = $1 
		 ORDER BY sort_order ASC, created_at DESC`,
		zoneID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var methods []Method
	for rows.Next() {
		var m Method
		if err := rows.Scan(&m.ID, &m.ZoneID, &m.ProviderKey, &m.ServiceCode, &m.Title, &m.Enabled, &m.SortOrder, &m.PricingMode, &m.PricingRulesJSON, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		methods = append(methods, m)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return methods, nil
}

func (s *Store) DeleteMethod(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("id is required")
	}

	result, err := s.db.ExecContext(
		ctx,
		"DELETE FROM shipping_methods WHERE id = $1",
		id,
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
