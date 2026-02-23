package main

import (
	"context"
	"errors"
	"log"
	"os"
	"strings"

	"goecommerce/internal/modules/adminauth"
	platformdb "goecommerce/internal/platform/db"
	storadminauth "goecommerce/internal/storage/adminauth"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("No .env file found: %v", err)
	}

	emailRaw := os.Getenv("ADMIN_SEED_EMAIL")
	passwordRaw := os.Getenv("ADMIN_SEED_PASSWORD")
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))

	if strings.TrimSpace(emailRaw) == "" {
		log.Fatal("ADMIN_SEED_EMAIL is required")
	}
	if strings.TrimSpace(passwordRaw) == "" {
		log.Fatal("ADMIN_SEED_PASSWORD is required")
	}
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	email, err := adminauth.NormalizeAndValidateEmail(emailRaw)
	if err != nil {
		log.Fatalf("invalid ADMIN_SEED_EMAIL: %v", err)
	}
	password, err := adminauth.NormalizeAndValidatePassword(passwordRaw)
	if err != nil {
		log.Fatalf("invalid ADMIN_SEED_PASSWORD: %v", err)
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	defer db.Close()

	store, err := storadminauth.NewStore(ctx, db)
	if err != nil {
		log.Fatalf("failed to initialize auth store: %v", err)
	}
	role, err := store.GetRoleByCode(ctx, "admin")
	if err != nil {
		log.Fatalf("failed to load admin role: %v", err)
	}

	user, created, err := findOrCreateUser(ctx, store, email, password)
	if err != nil {
		log.Fatalf("failed to create seed admin: %v", err)
	}
	if err := store.AssignRole(ctx, user.ID, role.ID); err != nil {
		log.Fatalf("failed to assign admin role: %v", err)
	}

	if created {
		log.Printf("admin user created: %s", user.Email)
	} else {
		log.Printf("admin user already exists: %s", user.Email)
	}
	log.Printf("admin role ensured for user: %s", user.Email)
}

func findOrCreateUser(ctx context.Context, store *storadminauth.Store, email, password string) (storadminauth.User, bool, error) {
	existing, err := store.GetUserByEmail(ctx, email)
	if err == nil {
		return existing, false, nil
	}
	if !errors.Is(err, storadminauth.ErrNotFound) {
		return storadminauth.User{}, false, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return storadminauth.User{}, false, err
	}

	displayName := deriveDisplayNameFromEmail(email)
	created, err := store.CreateUser(ctx, email, string(hash), displayName)
	if err != nil {
		if errors.Is(err, storadminauth.ErrConflict) {
			u, lookupErr := store.GetUserByEmail(ctx, email)
			return u, false, lookupErr
		}
		return storadminauth.User{}, false, err
	}
	return created, true, nil
}

func deriveDisplayNameFromEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	local := strings.TrimSpace(parts[0])
	if local == "" {
		return "Admin"
	}
	return local
}
