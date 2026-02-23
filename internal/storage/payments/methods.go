package payments

import (
	"context"
	"database/sql"
	"errors"
)

func (s *Store) CreateMethod(ctx context.Context, method PaymentMethod) (string, error) {
	if method.Key == "" {
		return "", errors.New("key is required")
	}
	if method.Title == "" {
		return "", errors.New("title is required")
	}
	if method.MethodName == "" {
		return "", errors.New("method_name is required")
	}
	if method.PaymentType == "" {
		method.PaymentType = "manual"
	}
	if method.ConfigJSON == nil {
		method.ConfigJSON = []byte("{}")
	}

	var id string
	err := s.db.QueryRowContext(
		ctx,
		`INSERT INTO payment_methods (key, method_name, title, description, instructions, enabled, payment_type, config_json, sort_order) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
		 RETURNING id`,
		method.Key, method.MethodName, method.Title, method.Description, method.Instructions, method.Enabled, method.PaymentType, method.ConfigJSON, method.SortOrder,
	).Scan(&id)

	return id, err
}

func (s *Store) UpdateMethod(ctx context.Context, method PaymentMethod) error {
	if method.ID == "" {
		return errors.New("id is required")
	}
	if method.Key == "" {
		return errors.New("key is required")
	}
	if method.Title == "" {
		return errors.New("title is required")
	}
	if method.MethodName == "" {
		return errors.New("method_name is required")
	}
	if method.PaymentType == "" {
		method.PaymentType = "manual"
	}
	if method.ConfigJSON == nil {
		method.ConfigJSON = []byte("{}")
	}

	result, err := s.db.ExecContext(
		ctx,
		`UPDATE payment_methods 
		 SET key = $1, method_name = $2, title = $3, description = $4, instructions = $5, enabled = $6, payment_type = $7, config_json = $8, sort_order = $9, updated_at = now() 
		 WHERE id = $10`,
		method.Key, method.MethodName, method.Title, method.Description, method.Instructions, method.Enabled, method.PaymentType, method.ConfigJSON, method.SortOrder, method.ID,
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

func (s *Store) GetMethod(ctx context.Context, id string) (*PaymentMethod, error) {
	if id == "" {
		return nil, errors.New("id is required")
	}

	var m PaymentMethod
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, key, method_name, title, description, instructions, enabled, payment_type, config_json, sort_order, created_at, updated_at 
		 FROM payment_methods 
		 WHERE id = $1`,
		id,
	).Scan(&m.ID, &m.Key, &m.MethodName, &m.Title, &m.Description, &m.Instructions, &m.Enabled, &m.PaymentType, &m.ConfigJSON, &m.SortOrder, &m.CreatedAt, &m.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}

	return &m, nil
}

func (s *Store) GetMethodByKey(ctx context.Context, key string) (*PaymentMethod, error) {
	if key == "" {
		return nil, errors.New("key is required")
	}

	var m PaymentMethod
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, key, method_name, title, description, instructions, enabled, payment_type, config_json, sort_order, created_at, updated_at 
		 FROM payment_methods 
		 WHERE key = $1`,
		key,
	).Scan(&m.ID, &m.Key, &m.MethodName, &m.Title, &m.Description, &m.Instructions, &m.Enabled, &m.PaymentType, &m.ConfigJSON, &m.SortOrder, &m.CreatedAt, &m.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}

	return &m, nil
}

func (s *Store) ListMethods(ctx context.Context) ([]PaymentMethod, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, key, method_name, title, description, instructions, enabled, payment_type, config_json, sort_order, created_at, updated_at 
		 FROM payment_methods 
		 ORDER BY sort_order ASC, created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var methods []PaymentMethod
	for rows.Next() {
		var m PaymentMethod
		if err := rows.Scan(&m.ID, &m.Key, &m.MethodName, &m.Title, &m.Description, &m.Instructions, &m.Enabled, &m.PaymentType, &m.ConfigJSON, &m.SortOrder, &m.CreatedAt, &m.UpdatedAt); err != nil {
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
		"DELETE FROM payment_methods WHERE id = $1",
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
