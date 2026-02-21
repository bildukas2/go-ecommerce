package shipping

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"testing"

	"github.com/google/uuid"
	platformdb "goecommerce/internal/platform/db"
)

func TestZonesStore_CreateZone(t *testing.T) {
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
		name          string
		zoneName      string
		countriesJSON []byte
		wantErr       bool
	}{
		{
			name:          "valid zone",
			zoneName:      "Test Zone",
			countriesJSON: []byte(`["LT","LV","EE"]`),
			wantErr:       false,
		},
		{
			name:          "zone with empty countries",
			zoneName:      "Empty Zone",
			countriesJSON: []byte(`[]`),
			wantErr:       false,
		},
		{
			name:          "zone with null countries",
			zoneName:      "Null Zone",
			countriesJSON: nil,
			wantErr:       false,
		},
		{
			name:          "missing zone name",
			zoneName:      "",
			countriesJSON: []byte(`["LT"]`),
			wantErr:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, err := store.CreateZone(ctx, tt.zoneName, tt.countriesJSON)
			if (err != nil) != tt.wantErr {
				t.Fatalf("CreateZone error = %v, wantErr %v", err, tt.wantErr)
			}

			if !tt.wantErr {
				if id == "" {
					t.Fatalf("expected id, got empty string")
				}

				zone, err := store.GetZone(ctx, id)
				if err != nil {
					t.Fatalf("GetZone error: %v", err)
				}
				if zone.Name != tt.zoneName {
					t.Fatalf("expected name %q, got %q", tt.zoneName, zone.Name)
				}

				cleanupZone(t, db, id)
			}
		})
	}
}

func TestZonesStore_UpdateZone(t *testing.T) {
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

	id, err := store.CreateZone(ctx, "Original Zone", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, id)

	newCountries := []byte(`["LT","LV"]`)
	err = store.UpdateZone(ctx, id, "Updated Zone", newCountries, false)
	if err != nil {
		t.Fatalf("UpdateZone error: %v", err)
	}

	zone, err := store.GetZone(ctx, id)
	if err != nil {
		t.Fatalf("GetZone error: %v", err)
	}
	if zone.Name != "Updated Zone" {
		t.Fatalf("expected name %q, got %q", "Updated Zone", zone.Name)
	}
	if zone.Enabled != false {
		t.Fatalf("expected enabled false, got true")
	}

	var retrievedCountries []string
	if err := json.Unmarshal(zone.CountriesJSON, &retrievedCountries); err != nil {
		t.Fatalf("unmarshal countries error: %v", err)
	}
	expectedCountries := []string{"LT", "LV"}
	if len(retrievedCountries) != len(expectedCountries) {
		t.Fatalf("expected %d countries, got %d", len(expectedCountries), len(retrievedCountries))
	}
	for i, country := range expectedCountries {
		if retrievedCountries[i] != country {
			t.Fatalf("expected country %q at index %d, got %q", country, i, retrievedCountries[i])
		}
	}
}

func TestZonesStore_UpdateZone_NotFound(t *testing.T) {
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

	nonExistentID := uuid.New().String()
	err = store.UpdateZone(ctx, nonExistentID, "Test Zone", []byte(`["LT"]`), true)
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestZonesStore_GetZone(t *testing.T) {
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

	countries := []byte(`["LT","LV"]`)
	id, err := store.CreateZone(ctx, "Get Test Zone", countries)
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, id)

	zone, err := store.GetZone(ctx, id)
	if err != nil {
		t.Fatalf("GetZone error: %v", err)
	}
	if zone == nil {
		t.Fatalf("expected zone, got nil")
	}
	if zone.ID != id {
		t.Fatalf("expected id %q, got %q", id, zone.ID)
	}
	if zone.Name != "Get Test Zone" {
		t.Fatalf("expected name %q, got %q", "Get Test Zone", zone.Name)
	}
	if zone.Enabled != true {
		t.Fatalf("expected enabled true, got false")
	}

	nonExistentID := uuid.New().String()
	zone, err = store.GetZone(ctx, nonExistentID)
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestZonesStore_ListZones(t *testing.T) {
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

	id1, err := store.CreateZone(ctx, "List Zone 1", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone 1 error: %v", err)
	}
	defer cleanupZone(t, db, id1)

	id2, err := store.CreateZone(ctx, "List Zone 2", []byte(`["LV"]`))
	if err != nil {
		t.Fatalf("create zone 2 error: %v", err)
	}
	defer cleanupZone(t, db, id2)

	zones, err := store.ListZones(ctx)
	if err != nil {
		t.Fatalf("ListZones error: %v", err)
	}

	found1 := false
	found2 := false
	for _, z := range zones {
		if z.ID == id1 {
			found1 = true
		}
		if z.ID == id2 {
			found2 = true
		}
	}

	if !found1 {
		t.Fatalf("zone %q not found in list", id1)
	}
	if !found2 {
		t.Fatalf("zone %q not found in list", id2)
	}
}

func TestZonesStore_DeleteZone(t *testing.T) {
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

	id, err := store.CreateZone(ctx, "Delete Test Zone", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}

	err = store.DeleteZone(ctx, id)
	if err != nil {
		t.Fatalf("DeleteZone error: %v", err)
	}

	zone, err := store.GetZone(ctx, id)
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows after delete, got %v", err)
	}
	if zone != nil {
		t.Fatalf("expected nil zone after delete")
	}
}

func TestZonesStore_DeleteZone_NotFound(t *testing.T) {
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

	nonExistentID := uuid.New().String()
	err = store.DeleteZone(ctx, nonExistentID)
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestZonesStore_GetZoneByCountry(t *testing.T) {
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

	id, err := store.CreateZone(ctx, "Country Test Zone", []byte(`["LT","LV"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, id)

	zone, err := store.GetZoneByCountry(ctx, "LT")
	if err != nil {
		t.Fatalf("GetZoneByCountry error: %v", err)
	}
	if zone == nil {
		t.Fatalf("expected zone, got nil")
	}
	if zone.ID != id {
		t.Fatalf("expected zone id %q, got %q", id, zone.ID)
	}

	zone, err = store.GetZoneByCountry(ctx, "LV")
	if err != nil {
		t.Fatalf("GetZoneByCountry error for LV: %v", err)
	}
	if zone == nil {
		t.Fatalf("expected zone for LV, got nil")
	}

	zone, err = store.GetZoneByCountry(ctx, "DE")
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows for non-existent country, got %v", err)
	}
}

func TestZonesStore_CountriesJSON(t *testing.T) {
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

	countriesObj := []string{"LT", "LV", "EE"}
	countriesJSON, _ := json.Marshal(countriesObj)

	id, err := store.CreateZone(ctx, "JSON Test Zone", countriesJSON)
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, id)

	zone, err := store.GetZone(ctx, id)
	if err != nil {
		t.Fatalf("GetZone error: %v", err)
	}

	var retrieved []string
	if err := json.Unmarshal(zone.CountriesJSON, &retrieved); err != nil {
		t.Fatalf("unmarshal countries error: %v", err)
	}

	if len(retrieved) != len(countriesObj) {
		t.Fatalf("expected %d countries, got %d", len(countriesObj), len(retrieved))
	}
	for i, country := range countriesObj {
		if retrieved[i] != country {
			t.Fatalf("expected country %q at index %d, got %q", country, i, retrieved[i])
		}
	}
}

func cleanupZone(t *testing.T, db *sql.DB, id string) {
	ctx := context.Background()
	_, err := db.ExecContext(ctx, "DELETE FROM shipping_zones WHERE id = $1", id)
	if err != nil {
		t.Logf("cleanup error for zone %q: %v", id, err)
	}
}
