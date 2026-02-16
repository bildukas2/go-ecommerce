package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("No .env file found: %v", err)
	}

	cmd := "up"
	if len(os.Args) > 1 {
		cmd = strings.ToLower(strings.TrimSpace(os.Args[1]))
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatalf("DATABASE_URL is required")
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := db.PingContext(context.Background()); err != nil {
		log.Fatal(err)
	}

	goose.SetDialect("postgres")

	modDirs, err := moduleMigrationDirs()
	if err != nil {
		log.Fatal(err)
	}
	if len(modDirs) == 0 {
		log.Println("no module migrations found; nothing to do")
		return
	}

	switch cmd {
	case "up":
		for _, dir := range modDirs {
			log.Printf("applying migrations: %s", dir)
			if err := goose.Up(db, dir); err != nil {
				log.Fatal(err)
			}
		}
		log.Println("migrations up complete")
	case "status":
		for _, dir := range modDirs {
			fmt.Printf("\n== %s ==\n", dir)
			if err := goose.Status(db, dir); err != nil {
				log.Fatal(err)
			}
		}
	default:
		log.Fatalf("unsupported command: %s (supported: up, status)", cmd)
	}
}

func moduleMigrationDirs() ([]string, error) {
	root := projectRoot()
	modsRoot := filepath.Join(root, "internal", "modules")
	entries, err := os.ReadDir(modsRoot)
	if err != nil {
		return nil, err
	}
	enabled := parseEnabled(os.Getenv("ENABLED_MODULES"))
	dirs := make([]string, 0, len(entries)+1)

	// Add root migrations directory if it exists
	globalMigDir := filepath.Join(root, "migrations")
	if st, err := os.Stat(globalMigDir); err == nil && st.IsDir() {
		dirs = append(dirs, globalMigDir)
	}

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := strings.ToLower(e.Name())
		if !enabledModule(name, enabled) {
			continue
		}
		migDir := filepath.Join(modsRoot, name, "migrations")
		if st, err := os.Stat(migDir); err == nil && st.IsDir() {
			dirs = append(dirs, migDir)
		}
	}
	sort.Strings(dirs)
	return dirs, nil
}

func enabledModule(name string, enabled map[string]bool) bool {
	if enabled == nil {
		return true
	}
	if enabled["all"] || enabled["*"] {
		return true
	}
	return enabled[strings.ToLower(strings.TrimSpace(name))]
}

func parseEnabled(val string) map[string]bool {
	val = strings.TrimSpace(val)
	if val == "" {
		return nil
	}
	parts := strings.Split(val, ",")
	m := make(map[string]bool, len(parts))
	for _, p := range parts {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			m[p] = true
		}
	}
	return m
}

func projectRoot() string {
	wd, err := os.Getwd()
	if err != nil {
		return "."
	}
	return wd
}
