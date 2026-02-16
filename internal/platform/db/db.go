package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Open returns a configured *sql.DB using the provided DSN (DATABASE_URL).
// It sets conservative defaults for connection pooling suitable for a small API service.
func Open(ctx context.Context, dsn string) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	// Pool settings (can be tuned later or overridden via envs if desired)
	maxOpen := 10
	maxIdle := 5
	if v := os.Getenv("DB_MAX_OPEN"); v != "" {
		if n, err := parseInt(v); err == nil {
			maxOpen = n
		}
	}
	if v := os.Getenv("DB_MAX_IDLE"); v != "" {
		if n, err := parseInt(v); err == nil {
			maxIdle = n
		}
	}
	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxIdle)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func parseInt(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}
