package adminauth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	platformdb "goecommerce/internal/platform/db"
)

func TestAdminAuthStoreUserCreateGetAndDuplicate(t *testing.T) {
	store, db, cleanup := openAdminAuthStore(t)
	defer cleanup()

	ctx := context.Background()
	email := fmt.Sprintf("adminauth-user-%d@example.com", time.Now().UnixNano())
	passwordHash := "hash-abc"
	displayName := "Admin User"

	created, err := store.CreateUser(ctx, email, passwordHash, displayName)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	if created.Email != email {
		t.Fatalf("expected email %s, got %s", email, created.Email)
	}
	if created.DisplayName != displayName {
		t.Fatalf("expected display name %s, got %s", displayName, created.DisplayName)
	}
	if created.LastLoginAt != nil {
		t.Fatalf("expected nil last_login_at for new user")
	}

	fetched, err := store.GetUserByEmail(ctx, email)
	if err != nil {
		t.Fatalf("get user by email: %v", err)
	}
	if fetched.ID != created.ID {
		t.Fatalf("expected user id %s, got %s", created.ID, fetched.ID)
	}

	_, err = store.CreateUser(ctx, email, "hash-other", "Duplicate")
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("expected ErrConflict for duplicate user, got %v", err)
	}

	if _, err := db.ExecContext(ctx, `DELETE FROM users WHERE id = $1::uuid`, created.ID); err != nil {
		t.Fatalf("cleanup user: %v", err)
	}
}

func TestAdminAuthStoreRolesAssignAndList(t *testing.T) {
	store, db, cleanup := openAdminAuthStore(t)
	defer cleanup()

	ctx := context.Background()
	email := fmt.Sprintf("adminauth-role-%d@example.com", time.Now().UnixNano())
	user, err := store.CreateUser(ctx, email, "hash-role", "Role User")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM users WHERE id = $1::uuid`, user.ID)
	}()

	role, err := store.GetRoleByCode(ctx, "admin")
	if err != nil {
		t.Fatalf("get admin role: %v", err)
	}
	if role.Code != "admin" {
		t.Fatalf("expected admin role code, got %s", role.Code)
	}

	if err := store.AssignRole(ctx, user.ID, role.ID); err != nil {
		t.Fatalf("assign role first time: %v", err)
	}
	if err := store.AssignRole(ctx, user.ID, role.ID); err != nil {
		t.Fatalf("assign role second time should be idempotent: %v", err)
	}

	codes, err := store.ListRoleCodesByUserID(ctx, user.ID)
	if err != nil {
		t.Fatalf("list role codes: %v", err)
	}
	if len(codes) != 1 || codes[0] != "admin" {
		t.Fatalf("expected one admin role, got %#v", codes)
	}
}

func TestAdminAuthStoreUpdateLastLoginAt(t *testing.T) {
	store, db, cleanup := openAdminAuthStore(t)
	defer cleanup()

	ctx := context.Background()
	email := fmt.Sprintf("adminauth-login-%d@example.com", time.Now().UnixNano())
	user, err := store.CreateUser(ctx, email, "hash-login", "Login User")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM users WHERE id = $1::uuid`, user.ID)
	}()

	loginAt := time.Now().UTC().Truncate(time.Second)
	if err := store.UpdateLastLoginAt(ctx, user.ID, loginAt); err != nil {
		t.Fatalf("update last login at: %v", err)
	}

	fetched, err := store.GetUserByEmail(ctx, email)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}
	if fetched.LastLoginAt == nil {
		t.Fatalf("expected last_login_at to be set")
	}
	if !fetched.LastLoginAt.UTC().Equal(loginAt) {
		t.Fatalf("expected last_login_at %s, got %s", loginAt, fetched.LastLoginAt.UTC())
	}
}

func openAdminAuthStore(t *testing.T) (*Store, *sql.DB, func()) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping adminauth storage integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}

	assertTableExists(t, ctx, db, "users")
	assertTableExists(t, ctx, db, "roles")
	assertTableExists(t, ctx, db, "user_roles")

	store, err := NewStore(ctx, db)
	if err != nil {
		_ = db.Close()
		t.Fatalf("new store error: %v", err)
	}

	cleanup := func() {
		_ = store.Close()
		_ = db.Close()
	}
	return store, db, cleanup
}

func assertTableExists(t *testing.T, ctx context.Context, db *sql.DB, name string) {
	t.Helper()
	var regclass *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public."+name+"')").Scan(&regclass); err != nil || regclass == nil || *regclass == "" {
		t.Skipf("%s table not present; apply migrations to run this test", name)
	}
}
