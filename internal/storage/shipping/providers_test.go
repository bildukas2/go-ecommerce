package shipping

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"testing"

	platformdb "goecommerce/internal/platform/db"
)

func TestProvidersStore_CreateProvider(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}

	tests := []struct {
		name      string
		key       string
		provName  string
		mode      string
		configJSON []byte
		wantErr   bool
	}{
		{
			name:      "valid provider",
			key:       "test-omniva",
			provName:  "Omniva",
			mode:      "sandbox",
			configJSON: []byte(`{"username":"test","password":"test"}`),
			wantErr:   false,
		},
		{
			name:      "missing key",
			key:       "",
			provName:  "Test Provider",
			mode:      "sandbox",
			configJSON: []byte(`{}`),
			wantErr:   true,
		},
		{
			name:      "missing name",
			key:       "test-key",
			provName:  "",
			mode:      "sandbox",
			configJSON: []byte(`{}`),
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cleanupProvider(t, db, tt.key)

			err := store.CreateProvider(ctx, tt.key, tt.provName, tt.mode, tt.configJSON)
			if (err != nil) != tt.wantErr {
				t.Fatalf("CreateProvider error = %v, wantErr %v", err, tt.wantErr)
			}

			if !tt.wantErr {
				p, err := store.GetProvider(ctx, tt.key)
				if err != nil {
					t.Fatalf("GetProvider error: %v", err)
				}
				if p.Key != tt.key {
					t.Fatalf("expected key %q, got %q", tt.key, p.Key)
				}
				if p.Name != tt.provName {
					t.Fatalf("expected name %q, got %q", tt.provName, p.Name)
				}
				if p.Mode != tt.mode {
					t.Fatalf("expected mode %q, got %q", tt.mode, p.Mode)
				}
			}

			cleanupProvider(t, db, tt.key)
		})
	}
}

func TestProvidersStore_UpdateProvider(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}

	key := "test-update-provider"
	cleanupProvider(t, db, key)
	defer cleanupProvider(t, db, key)

	err = store.CreateProvider(ctx, key, "Test Provider", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	newConfig := []byte(`{"username":"updated","password":"newpass"}`)
	err = store.UpdateProvider(ctx, key, true, "live", newConfig)
	if err != nil {
		t.Fatalf("UpdateProvider error: %v", err)
	}

	p, err := store.GetProvider(ctx, key)
	if err != nil {
		t.Fatalf("GetProvider error: %v", err)
	}
	if !p.Enabled {
		t.Fatalf("expected enabled true, got false")
	}
	if p.Mode != "live" {
		t.Fatalf("expected mode %q, got %q", "live", p.Mode)
	}
	if string(p.ConfigJSON) != string(newConfig) {
		t.Fatalf("expected config %q, got %q", newConfig, p.ConfigJSON)
	}
}

func TestProvidersStore_UpdateProvider_NotFound(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}

	err = store.UpdateProvider(ctx, "non-existent-key", true, "sandbox", []byte(`{}`))
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestProvidersStore_GetProvider(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}

	key := "test-get-provider"
	cleanupProvider(t, db, key)
	defer cleanupProvider(t, db, key)

	err = store.CreateProvider(ctx, key, "Get Test", "sandbox", []byte(`{"key":"value"}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	p, err := store.GetProvider(ctx, key)
	if err != nil {
		t.Fatalf("GetProvider error: %v", err)
	}
	if p == nil {
		t.Fatalf("expected provider, got nil")
	}
	if p.Key != key {
		t.Fatalf("expected key %q, got %q", key, p.Key)
	}
	if p.Name != "Get Test" {
		t.Fatalf("expected name %q, got %q", "Get Test", p.Name)
	}

	p, err = store.GetProvider(ctx, "non-existent-key")
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestProvidersStore_ListProviders(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}

	key1 := "test-list-1"
	key2 := "test-list-2"
	cleanupProvider(t, db, key1)
	cleanupProvider(t, db, key2)
	defer cleanupProvider(t, db, key1)
	defer cleanupProvider(t, db, key2)

	err = store.CreateProvider(ctx, key1, "Provider 1", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider 1 error: %v", err)
	}

	err = store.CreateProvider(ctx, key2, "Provider 2", "live", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider 2 error: %v", err)
	}

	providers, err := store.ListProviders(ctx)
	if err != nil {
		t.Fatalf("ListProviders error: %v", err)
	}

	found1 := false
	found2 := false
	for _, p := range providers {
		if p.Key == key1 {
			found1 = true
		}
		if p.Key == key2 {
			found2 = true
		}
	}

	if !found1 {
		t.Fatalf("provider %q not found in list", key1)
	}
	if !found2 {
		t.Fatalf("provider %q not found in list", key2)
	}
}

func TestProvidersStore_DeleteProvider(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}

	key := "test-delete-provider"
	cleanupProvider(t, db, key)

	err = store.CreateProvider(ctx, key, "Delete Test", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	err = store.DeleteProvider(ctx, key)
	if err != nil {
		t.Fatalf("DeleteProvider error: %v", err)
	}

	p, err := store.GetProvider(ctx, key)
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows after delete, got %v", err)
	}
	if p != nil {
		t.Fatalf("expected nil provider after delete")
	}
}

func TestProvidersStore_DeleteProvider_NotFound(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}

	err = store.DeleteProvider(ctx, "non-existent-key")
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestProvidersStore_ConfigJSON(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}

	key := "test-config-json"
	cleanupProvider(t, db, key)
	defer cleanupProvider(t, db, key)

	configObj := map[string]interface{}{
		"username": "testuser",
		"password": "testpass",
		"api_url":  "https://api.example.com",
	}
	configJSON, _ := json.Marshal(configObj)

	err = store.CreateProvider(ctx, key, "Config Test", "sandbox", configJSON)
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	p, err := store.GetProvider(ctx, key)
	if err != nil {
		t.Fatalf("GetProvider error: %v", err)
	}

	var retrieved map[string]interface{}
	if err := json.Unmarshal(p.ConfigJSON, &retrieved); err != nil {
		t.Fatalf("unmarshal config error: %v", err)
	}

	if retrieved["username"] != configObj["username"] {
		t.Fatalf("expected username %q, got %q", configObj["username"], retrieved["username"])
	}
	if retrieved["password"] != configObj["password"] {
		t.Fatalf("expected password %q, got %q", configObj["password"], retrieved["password"])
	}
}

func cleanupProvider(t *testing.T, db *sql.DB, key string) {
	ctx := context.Background()
	_, err := db.ExecContext(ctx, "DELETE FROM shipping_providers WHERE key = $1", key)
	if err != nil {
		t.Logf("cleanup error for key %q: %v", key, err)
	}
}
