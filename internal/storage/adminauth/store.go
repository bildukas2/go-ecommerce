package adminauth

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict")
	ErrInvalid  = errors.New("invalid")
)

type User struct {
	ID           string
	Email        string
	PasswordHash string
	DisplayName  string
	IsActive     bool
	LastLoginAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Role struct {
	ID   int16
	Code string
	Name string
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

func (s *Store) CreateUser(ctx context.Context, email, passwordHash, displayName string) (User, error) {
	email = normalizeEmail(email)
	passwordHash = strings.TrimSpace(passwordHash)
	displayName = strings.TrimSpace(displayName)
	if email == "" || passwordHash == "" || displayName == "" {
		return User{}, ErrInvalid
	}

	var (
		u           User
		lastLoginAt sql.NullTime
	)
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO users (email, password_hash, display_name)
		VALUES ($1, $2, $3)
		RETURNING id, email, password_hash, display_name, is_active, last_login_at, created_at, updated_at
	`, email, passwordHash, displayName).Scan(
		&u.ID,
		&u.Email,
		&u.PasswordHash,
		&u.DisplayName,
		&u.IsActive,
		&lastLoginAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return User{}, ErrConflict
		}
		return User{}, err
	}
	if lastLoginAt.Valid {
		t := lastLoginAt.Time
		u.LastLoginAt = &t
	}
	return u, nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (User, error) {
	email = normalizeEmail(email)
	if email == "" {
		return User{}, ErrInvalid
	}

	var (
		u           User
		lastLoginAt sql.NullTime
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, password_hash, display_name, is_active, last_login_at, created_at, updated_at
		FROM users
		WHERE email = $1
	`, email).Scan(
		&u.ID,
		&u.Email,
		&u.PasswordHash,
		&u.DisplayName,
		&u.IsActive,
		&lastLoginAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, err
	}
	if lastLoginAt.Valid {
		t := lastLoginAt.Time
		u.LastLoginAt = &t
	}
	return u, nil
}

func (s *Store) GetRoleByCode(ctx context.Context, code string) (Role, error) {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return Role{}, ErrInvalid
	}

	var r Role
	err := s.db.QueryRowContext(ctx, `
		SELECT id, code, name
		FROM roles
		WHERE code = $1
	`, code).Scan(&r.ID, &r.Code, &r.Name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Role{}, ErrNotFound
		}
		return Role{}, err
	}
	return r, nil
}

func (s *Store) AssignRole(ctx context.Context, userID string, roleID int16) error {
	userID = strings.TrimSpace(userID)
	if userID == "" || roleID <= 0 {
		return ErrInvalid
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		VALUES ($1::uuid, $2)
		ON CONFLICT (user_id, role_id) DO NOTHING
	`, userID, roleID)
	if err != nil {
		if isForeignKeyViolation(err) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (s *Store) ListRoleCodesByUserID(ctx context.Context, userID string) ([]string, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, ErrInvalid
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT r.code
		FROM user_roles ur
		JOIN roles r ON r.id = ur.role_id
		WHERE ur.user_id = $1::uuid
		ORDER BY r.code ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]string, 0, 2)
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		out = append(out, code)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) HasAnyAdmin(ctx context.Context) (bool, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM user_roles ur
		JOIN roles r ON r.id = ur.role_id
		WHERE r.code = 'admin'
	`).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Store) UpdateLastLoginAt(ctx context.Context, userID string, at time.Time) error {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return ErrInvalid
	}

	res, err := s.db.ExecContext(ctx, `
		UPDATE users
		SET last_login_at = $2,
			updated_at = now()
		WHERE id = $1::uuid
	`, userID, at.UTC())
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23505"
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23503"
}
