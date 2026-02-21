package shipping

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"testing"
	"time"

	platformdb "goecommerce/internal/platform/db"
)

func TestTerminalsStore_GetCachedTerminals_NotFound(t *testing.T) {
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

	payload, fetchedAt, err := store.GetCachedTerminals(ctx, "omniva", "XX")
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
	if payload != nil {
		t.Fatalf("expected nil payload, got %v", payload)
	}
	if !fetchedAt.IsZero() {
		t.Fatalf("expected zero time, got %v", fetchedAt)
	}
}

func TestTerminalsStore_UpsertCachedTerminals(t *testing.T) {
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

	providerKey := "test-omniva-upsert"
	country := "LT"
	payload := []byte(`[{"id":"1","name":"Terminal 1"},{"id":"2","name":"Terminal 2"}]`)

	cleanupProvider(t, db, providerKey)
	cleanupTerminals(t, db, providerKey, country)
	defer cleanupProvider(t, db, providerKey)
	defer cleanupTerminals(t, db, providerKey, country)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte("{}"))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	err = store.UpsertCachedTerminals(ctx, providerKey, country, payload)
	if err != nil {
		t.Fatalf("UpsertCachedTerminals error: %v", err)
	}

	retrieved, fetchedAt, err := store.GetCachedTerminals(ctx, providerKey, country)
	if err != nil {
		t.Fatalf("GetCachedTerminals error: %v", err)
	}
	if !jsonEqual(retrieved, payload) {
		t.Fatalf("expected payload %q, got %q", payload, retrieved)
	}
	if fetchedAt.IsZero() {
		t.Fatalf("expected non-zero fetched_at")
	}
}

func TestTerminalsStore_UpsertCachedTerminals_Update(t *testing.T) {
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

	providerKey := "test-omniva-update"
	country := "LV"
	payload1 := []byte(`[{"id":"1","name":"Terminal 1"}]`)
	payload2 := []byte(`[{"id":"1","name":"Terminal 1 Updated"},{"id":"2","name":"Terminal 2"}]`)

	cleanupProvider(t, db, providerKey)
	cleanupTerminals(t, db, providerKey, country)
	defer cleanupProvider(t, db, providerKey)
	defer cleanupTerminals(t, db, providerKey, country)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte("{}"))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	err = store.UpsertCachedTerminals(ctx, providerKey, country, payload1)
	if err != nil {
		t.Fatalf("first UpsertCachedTerminals error: %v", err)
	}

	retrieved1, fetchedAt1, err := store.GetCachedTerminals(ctx, providerKey, country)
	if err != nil {
		t.Fatalf("first GetCachedTerminals error: %v", err)
	}
	if !jsonEqual(retrieved1, payload1) {
		t.Fatalf("expected payload %q, got %q", payload1, retrieved1)
	}

	time.Sleep(100 * time.Millisecond)

	err = store.UpsertCachedTerminals(ctx, providerKey, country, payload2)
	if err != nil {
		t.Fatalf("second UpsertCachedTerminals error: %v", err)
	}

	retrieved2, fetchedAt2, err := store.GetCachedTerminals(ctx, providerKey, country)
	if err != nil {
		t.Fatalf("second GetCachedTerminals error: %v", err)
	}
	if !jsonEqual(retrieved2, payload2) {
		t.Fatalf("expected updated payload %q, got %q", payload2, retrieved2)
	}

	if fetchedAt2.Before(fetchedAt1) {
		t.Fatalf("expected fetchedAt2 %v to be after fetchedAt1 %v", fetchedAt2, fetchedAt1)
	}
}

func TestTerminalsStore_UpsertCachedTerminals_NilPayload(t *testing.T) {
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

	providerKey := "test-omniva-nil"
	country := "EE"

	cleanupProvider(t, db, providerKey)
	cleanupTerminals(t, db, providerKey, country)
	defer cleanupProvider(t, db, providerKey)
	defer cleanupTerminals(t, db, providerKey, country)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte("{}"))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	err = store.UpsertCachedTerminals(ctx, providerKey, country, nil)
	if err != nil {
		t.Fatalf("UpsertCachedTerminals with nil payload error: %v", err)
	}

	retrieved, _, err := store.GetCachedTerminals(ctx, providerKey, country)
	if err != nil {
		t.Fatalf("GetCachedTerminals error: %v", err)
	}
	if string(retrieved) != "[]" {
		t.Fatalf("expected empty array payload, got %q", retrieved)
	}
}

func TestTerminalsStore_GetCachedTerminals_MissingProvider(t *testing.T) {
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

	_, _, err = store.GetCachedTerminals(ctx, "", "LT")
	if err == nil {
		t.Fatalf("expected error for empty provider_key")
	}

	_, _, err = store.GetCachedTerminals(ctx, "omniva", "")
	if err == nil {
		t.Fatalf("expected error for empty country")
	}
}

func TestTerminalsStore_UpsertCachedTerminals_MissingProvider(t *testing.T) {
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

	err = store.UpsertCachedTerminals(ctx, "", "LT", []byte("[]"))
	if err == nil {
		t.Fatalf("expected error for empty provider_key")
	}

	err = store.UpsertCachedTerminals(ctx, "omniva", "", []byte("[]"))
	if err == nil {
		t.Fatalf("expected error for empty country")
	}
}

func TestTerminalsStore_DeleteCachedTerminals(t *testing.T) {
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

	providerKey := "test-omniva-delete"
	country := "LT"
	payload := []byte(`[{"id":"1","name":"Terminal 1"}]`)

	cleanupProvider(t, db, providerKey)
	cleanupTerminals(t, db, providerKey, country)
	defer cleanupProvider(t, db, providerKey)
	defer cleanupTerminals(t, db, providerKey, country)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte("{}"))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	err = store.UpsertCachedTerminals(ctx, providerKey, country, payload)
	if err != nil {
		t.Fatalf("UpsertCachedTerminals error: %v", err)
	}

	err = store.DeleteCachedTerminals(ctx, providerKey, country)
	if err != nil {
		t.Fatalf("DeleteCachedTerminals error: %v", err)
	}

	_, _, err = store.GetCachedTerminals(ctx, providerKey, country)
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows after delete, got %v", err)
	}
}

func TestTerminalsStore_DeleteCachedTerminals_NotFound(t *testing.T) {
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

	err = store.DeleteCachedTerminals(ctx, "non-existent-provider", "XX")
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestTerminalsStore_DeleteCachedTerminals_MissingProvider(t *testing.T) {
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

	err = store.DeleteCachedTerminals(ctx, "", "LT")
	if err == nil {
		t.Fatalf("expected error for empty provider_key")
	}

	err = store.DeleteCachedTerminals(ctx, "omniva", "")
	if err == nil {
		t.Fatalf("expected error for empty country")
	}
}

func TestTerminalsStore_MultipleProviders(t *testing.T) {
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

	provider1 := "test-omniva-multi"
	provider2 := "test-dpd-multi"
	country := "LT"
	payload1 := []byte(`[{"id":"1","name":"Omniva Terminal"}]`)
	payload2 := []byte(`[{"id":"2","name":"DPD Terminal"}]`)

	cleanupProvider(t, db, provider1)
	cleanupProvider(t, db, provider2)
	cleanupTerminals(t, db, provider1, country)
	cleanupTerminals(t, db, provider2, country)
	defer cleanupProvider(t, db, provider1)
	defer cleanupProvider(t, db, provider2)
	defer cleanupTerminals(t, db, provider1, country)
	defer cleanupTerminals(t, db, provider2, country)

	err = store.CreateProvider(ctx, provider1, "Test Provider 1", "sandbox", []byte("{}"))
	if err != nil {
		t.Fatalf("create provider1 error: %v", err)
	}

	err = store.CreateProvider(ctx, provider2, "Test Provider 2", "sandbox", []byte("{}"))
	if err != nil {
		t.Fatalf("create provider2 error: %v", err)
	}

	err = store.UpsertCachedTerminals(ctx, provider1, country, payload1)
	if err != nil {
		t.Fatalf("first UpsertCachedTerminals error: %v", err)
	}

	err = store.UpsertCachedTerminals(ctx, provider2, country, payload2)
	if err != nil {
		t.Fatalf("second UpsertCachedTerminals error: %v", err)
	}

	retrieved1, _, err := store.GetCachedTerminals(ctx, provider1, country)
	if err != nil {
		t.Fatalf("first GetCachedTerminals error: %v", err)
	}
	if !jsonEqual(retrieved1, payload1) {
		t.Fatalf("expected payload1 %q, got %q", payload1, retrieved1)
	}

	retrieved2, _, err := store.GetCachedTerminals(ctx, provider2, country)
	if err != nil {
		t.Fatalf("second GetCachedTerminals error: %v", err)
	}
	if !jsonEqual(retrieved2, payload2) {
		t.Fatalf("expected payload2 %q, got %q", payload2, retrieved2)
	}
}

func TestTerminalsStore_MultipleCountries(t *testing.T) {
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

	provider := "test-omniva-countries"
	country1 := "LT"
	country2 := "LV"
	payloadLT := []byte(`[{"id":"1","name":"Vilnius"}]`)
	payloadLV := []byte(`[{"id":"2","name":"Riga"}]`)

	cleanupProvider(t, db, provider)
	cleanupTerminals(t, db, provider, country1)
	cleanupTerminals(t, db, provider, country2)
	defer cleanupProvider(t, db, provider)
	defer cleanupTerminals(t, db, provider, country1)
	defer cleanupTerminals(t, db, provider, country2)

	err = store.CreateProvider(ctx, provider, "Test Provider", "sandbox", []byte("{}"))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	err = store.UpsertCachedTerminals(ctx, provider, country1, payloadLT)
	if err != nil {
		t.Fatalf("UpsertCachedTerminals LT error: %v", err)
	}

	err = store.UpsertCachedTerminals(ctx, provider, country2, payloadLV)
	if err != nil {
		t.Fatalf("UpsertCachedTerminals LV error: %v", err)
	}

	retrievedLT, _, err := store.GetCachedTerminals(ctx, provider, country1)
	if err != nil {
		t.Fatalf("GetCachedTerminals LT error: %v", err)
	}
	if !jsonEqual(retrievedLT, payloadLT) {
		t.Fatalf("expected payloadLT %q, got %q", payloadLT, retrievedLT)
	}

	retrievedLV, _, err := store.GetCachedTerminals(ctx, provider, country2)
	if err != nil {
		t.Fatalf("GetCachedTerminals LV error: %v", err)
	}
	if !jsonEqual(retrievedLV, payloadLV) {
		t.Fatalf("expected payloadLV %q, got %q", payloadLV, retrievedLV)
	}
}

func cleanupTerminals(t *testing.T, db *sql.DB, providerKey, country string) {
	ctx := context.Background()
	_, err := db.ExecContext(ctx, "DELETE FROM shipping_terminals_cache WHERE provider_key = $1 AND country = $2", providerKey, country)
	if err != nil {
		t.Logf("cleanup error for provider %q country %q: %v", providerKey, country, err)
	}
}

func jsonEqual(a, b []byte) bool {
	var objA, objB interface{}
	if err := json.Unmarshal(a, &objA); err != nil {
		return false
	}
	if err := json.Unmarshal(b, &objB); err != nil {
		return false
	}
	aJSON, _ := json.Marshal(objA)
	bJSON, _ := json.Marshal(objB)
	return string(aJSON) == string(bJSON)
}
