package customers

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

var (
	ErrConflict = errors.New("conflict")
	ErrNotFound = errors.New("not found")
)

type Customer struct {
	ID           string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

type Session struct {
	ID         string
	CustomerID string
	TokenHash  string
	ExpiresAt  time.Time
	RevokedAt  sql.NullTime
	CreatedAt  time.Time
}

type Store struct {
	db *sql.DB
}

func NewStore(_ context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return nil }

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func (s *Store) CreateCustomer(ctx context.Context, email, passwordHash string) (Customer, error) {
	normalizedEmail := normalizeEmail(email)
	var c Customer
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO customers (email, password_hash)
		VALUES ($1, $2)
		ON CONFLICT (email) DO NOTHING
		RETURNING id, email, password_hash, created_at`, normalizedEmail, passwordHash).
		Scan(&c.ID, &c.Email, &c.PasswordHash, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Customer{}, ErrConflict
		}
		return Customer{}, err
	}
	return c, nil
}

func (s *Store) GetCustomerByEmail(ctx context.Context, email string) (Customer, error) {
	normalizedEmail := normalizeEmail(email)
	var c Customer
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, password_hash, created_at
		FROM customers
		WHERE email = $1`, normalizedEmail).
		Scan(&c.ID, &c.Email, &c.PasswordHash, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Customer{}, ErrNotFound
		}
		return Customer{}, err
	}
	return c, nil
}

func (s *Store) CreateSession(ctx context.Context, customerID, tokenHash string, expiresAt time.Time) (Session, error) {
	var sess Session
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO customer_sessions (customer_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, customer_id, token_hash, expires_at, revoked_at, created_at`, customerID, tokenHash, expiresAt).
		Scan(&sess.ID, &sess.CustomerID, &sess.TokenHash, &sess.ExpiresAt, &sess.RevokedAt, &sess.CreatedAt)
	if err != nil {
		return Session{}, err
	}
	return sess, nil
}

func (s *Store) GetCustomerBySessionTokenHash(ctx context.Context, tokenHash string) (Customer, error) {
	var c Customer
	err := s.db.QueryRowContext(ctx, `
		SELECT c.id, c.email, c.password_hash, c.created_at
		FROM customer_sessions cs
		JOIN customers c ON c.id = cs.customer_id
		WHERE cs.token_hash = $1
		AND cs.revoked_at IS NULL
		AND cs.expires_at > now()`, tokenHash).
		Scan(&c.ID, &c.Email, &c.PasswordHash, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Customer{}, ErrNotFound
		}
		return Customer{}, err
	}
	return c, nil
}

func (s *Store) RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE customer_sessions
		SET revoked_at = now()
		WHERE token_hash = $1 AND revoked_at IS NULL`, tokenHash)
	return err
}
