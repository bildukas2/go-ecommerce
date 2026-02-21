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

func TestMethodsStore_CreateMethod(t *testing.T) {
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

	providerKey := "test-provider-create"
	zoneName := "Test Zone Create"
	cleanupProvider(t, db, providerKey)
	defer cleanupProvider(t, db, providerKey)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	zoneID, err := store.CreateZone(ctx, zoneName, []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, zoneID)

	tests := []struct {
		name    string
		method  Method
		wantErr bool
	}{
		{
			name: "valid method",
			method: Method{
				ZoneID:           zoneID,
				ProviderKey:      providerKey,
				ServiceCode:      "STANDARD",
				Title:            "Standard Shipping",
				Enabled:          true,
				SortOrder:        1,
				PricingMode:      "fixed",
				PricingRulesJSON: []byte(`{"price": 5.00}`),
			},
			wantErr: false,
		},
		{
			name: "missing zone_id",
			method: Method{
				ZoneID:           "",
				ProviderKey:      providerKey,
				ServiceCode:      "EXPRESS",
				Title:            "Express Shipping",
				PricingMode:      "fixed",
				PricingRulesJSON: []byte(`{}`),
			},
			wantErr: true,
		},
		{
			name: "missing provider_key",
			method: Method{
				ZoneID:           zoneID,
				ProviderKey:      "",
				ServiceCode:      "EXPRESS",
				Title:            "Express Shipping",
				PricingMode:      "fixed",
				PricingRulesJSON: []byte(`{}`),
			},
			wantErr: true,
		},
		{
			name: "missing service_code",
			method: Method{
				ZoneID:           zoneID,
				ProviderKey:      providerKey,
				ServiceCode:      "",
				Title:            "Express Shipping",
				PricingMode:      "fixed",
				PricingRulesJSON: []byte(`{}`),
			},
			wantErr: true,
		},
		{
			name: "missing title",
			method: Method{
				ZoneID:           zoneID,
				ProviderKey:      providerKey,
				ServiceCode:      "EXPRESS",
				Title:            "",
				PricingMode:      "fixed",
				PricingRulesJSON: []byte(`{}`),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, err := store.CreateMethod(ctx, tt.method)
			if (err != nil) != tt.wantErr {
				t.Fatalf("CreateMethod error = %v, wantErr %v", err, tt.wantErr)
			}

			if !tt.wantErr {
				if id == "" {
					t.Fatalf("expected id, got empty string")
				}

				m, err := store.GetMethod(ctx, id)
				if err != nil {
					t.Fatalf("GetMethod error: %v", err)
				}
				if m.Title != tt.method.Title {
					t.Fatalf("expected title %q, got %q", tt.method.Title, m.Title)
				}
				if m.ServiceCode != tt.method.ServiceCode {
					t.Fatalf("expected service_code %q, got %q", tt.method.ServiceCode, m.ServiceCode)
				}

				cleanupMethod(t, db, id)
			}
		})
	}
}

func TestMethodsStore_UpdateMethod(t *testing.T) {
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

	providerKey := "test-provider-update"
	cleanupProvider(t, db, providerKey)
	defer cleanupProvider(t, db, providerKey)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	zoneID, err := store.CreateZone(ctx, "Test Zone Update", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, zoneID)

	methodID, err := store.CreateMethod(ctx, Method{
		ZoneID:           zoneID,
		ProviderKey:      providerKey,
		ServiceCode:      "STANDARD",
		Title:            "Standard Shipping",
		Enabled:          false,
		SortOrder:        1,
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{"price": 5.00}`),
	})
	if err != nil {
		t.Fatalf("create method error: %v", err)
	}
	defer cleanupMethod(t, db, methodID)

	updatedMethod := Method{
		ID:               methodID,
		ZoneID:           zoneID,
		ProviderKey:      providerKey,
		ServiceCode:      "EXPRESS",
		Title:            "Express Shipping",
		Enabled:          true,
		SortOrder:        2,
		PricingMode:      "table",
		PricingRulesJSON: []byte(`{"price": 10.00}`),
	}

	err = store.UpdateMethod(ctx, updatedMethod)
	if err != nil {
		t.Fatalf("UpdateMethod error: %v", err)
	}

	m, err := store.GetMethod(ctx, methodID)
	if err != nil {
		t.Fatalf("GetMethod error: %v", err)
	}
	if m.Title != "Express Shipping" {
		t.Fatalf("expected title %q, got %q", "Express Shipping", m.Title)
	}
	if m.ServiceCode != "EXPRESS" {
		t.Fatalf("expected service_code %q, got %q", "EXPRESS", m.ServiceCode)
	}
	if !m.Enabled {
		t.Fatalf("expected enabled true, got false")
	}
	if m.SortOrder != 2 {
		t.Fatalf("expected sort_order 2, got %d", m.SortOrder)
	}
	if m.PricingMode != "table" {
		t.Fatalf("expected pricing_mode %q, got %q", "table", m.PricingMode)
	}
}

func TestMethodsStore_UpdateMethod_NotFound(t *testing.T) {
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

	providerKey := "test-provider-update-notfound"
	cleanupProvider(t, db, providerKey)
	defer cleanupProvider(t, db, providerKey)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	zoneID, err := store.CreateZone(ctx, "Test Zone Update NotFound", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, zoneID)

	nonExistentID := uuid.New().String()
	err = store.UpdateMethod(ctx, Method{
		ID:               nonExistentID,
		ZoneID:           zoneID,
		ProviderKey:      providerKey,
		ServiceCode:      "TEST",
		Title:            "Test",
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{}`),
	})
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestMethodsStore_GetMethod(t *testing.T) {
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

	providerKey := "test-provider-get"
	cleanupProvider(t, db, providerKey)
	defer cleanupProvider(t, db, providerKey)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	zoneID, err := store.CreateZone(ctx, "Test Zone Get", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, zoneID)

	methodID, err := store.CreateMethod(ctx, Method{
		ZoneID:           zoneID,
		ProviderKey:      providerKey,
		ServiceCode:      "STANDARD",
		Title:            "Get Test Method",
		Enabled:          true,
		SortOrder:        1,
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{"price": 5.00}`),
	})
	if err != nil {
		t.Fatalf("create method error: %v", err)
	}
	defer cleanupMethod(t, db, methodID)

	m, err := store.GetMethod(ctx, methodID)
	if err != nil {
		t.Fatalf("GetMethod error: %v", err)
	}
	if m == nil {
		t.Fatalf("expected method, got nil")
	}
	if m.ID != methodID {
		t.Fatalf("expected id %q, got %q", methodID, m.ID)
	}
	if m.Title != "Get Test Method" {
		t.Fatalf("expected title %q, got %q", "Get Test Method", m.Title)
	}

	m, err = store.GetMethod(ctx, uuid.New().String())
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestMethodsStore_ListMethods(t *testing.T) {
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

	providerKey := "test-provider-list-all"
	cleanupProvider(t, db, providerKey)
	defer cleanupProvider(t, db, providerKey)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	zoneID, err := store.CreateZone(ctx, "Test Zone List All", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, zoneID)

	methodID1, err := store.CreateMethod(ctx, Method{
		ZoneID:           zoneID,
		ProviderKey:      providerKey,
		ServiceCode:      "STANDARD",
		Title:            "Standard Method",
		SortOrder:        1,
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{}`),
	})
	if err != nil {
		t.Fatalf("create method 1 error: %v", err)
	}
	defer cleanupMethod(t, db, methodID1)

	methodID2, err := store.CreateMethod(ctx, Method{
		ZoneID:           zoneID,
		ProviderKey:      providerKey,
		ServiceCode:      "EXPRESS",
		Title:            "Express Method",
		SortOrder:        2,
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{}`),
	})
	if err != nil {
		t.Fatalf("create method 2 error: %v", err)
	}
	defer cleanupMethod(t, db, methodID2)

	methods, err := store.ListMethods(ctx)
	if err != nil {
		t.Fatalf("ListMethods error: %v", err)
	}

	found1 := false
	found2 := false
	for _, m := range methods {
		if m.ID == methodID1 {
			found1 = true
		}
		if m.ID == methodID2 {
			found2 = true
		}
	}

	if !found1 {
		t.Fatalf("method %q not found in list", methodID1)
	}
	if !found2 {
		t.Fatalf("method %q not found in list", methodID2)
	}
}

func TestMethodsStore_ListMethodsByZone(t *testing.T) {
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

	providerKey := "test-provider-list-zone"
	cleanupProvider(t, db, providerKey)
	defer cleanupProvider(t, db, providerKey)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	zone1ID, err := store.CreateZone(ctx, "Test Zone 1", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone 1 error: %v", err)
	}
	defer cleanupZone(t, db, zone1ID)

	zone2ID, err := store.CreateZone(ctx, "Test Zone 2", []byte(`["LV"]`))
	if err != nil {
		t.Fatalf("create zone 2 error: %v", err)
	}
	defer cleanupZone(t, db, zone2ID)

	method1ID, err := store.CreateMethod(ctx, Method{
		ZoneID:           zone1ID,
		ProviderKey:      providerKey,
		ServiceCode:      "STANDARD",
		Title:            "Standard Method Zone 1",
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{}`),
	})
	if err != nil {
		t.Fatalf("create method 1 error: %v", err)
	}
	defer cleanupMethod(t, db, method1ID)

	method2ID, err := store.CreateMethod(ctx, Method{
		ZoneID:           zone1ID,
		ProviderKey:      providerKey,
		ServiceCode:      "EXPRESS",
		Title:            "Express Method Zone 1",
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{}`),
	})
	if err != nil {
		t.Fatalf("create method 2 error: %v", err)
	}
	defer cleanupMethod(t, db, method2ID)

	method3ID, err := store.CreateMethod(ctx, Method{
		ZoneID:           zone2ID,
		ProviderKey:      providerKey,
		ServiceCode:      "STANDARD",
		Title:            "Standard Method Zone 2",
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{}`),
	})
	if err != nil {
		t.Fatalf("create method 3 error: %v", err)
	}
	defer cleanupMethod(t, db, method3ID)

	methods, err := store.ListMethodsByZone(ctx, zone1ID)
	if err != nil {
		t.Fatalf("ListMethodsByZone error: %v", err)
	}

	if len(methods) < 2 {
		t.Fatalf("expected at least 2 methods for zone 1, got %d", len(methods))
	}

	found1 := false
	found2 := false
	for _, m := range methods {
		if m.ID == method1ID && m.ZoneID == zone1ID {
			found1 = true
		}
		if m.ID == method2ID && m.ZoneID == zone1ID {
			found2 = true
		}
	}

	if !found1 {
		t.Fatalf("method 1 not found in zone 1 list")
	}
	if !found2 {
		t.Fatalf("method 2 not found in zone 1 list")
	}

	methods2, err := store.ListMethodsByZone(ctx, zone2ID)
	if err != nil {
		t.Fatalf("ListMethodsByZone for zone 2 error: %v", err)
	}

	found3 := false
	for _, m := range methods2 {
		if m.ID == method3ID {
			found3 = true
		}
	}

	if !found3 {
		t.Fatalf("method 3 not found in zone 2 list")
	}
}

func TestMethodsStore_DeleteMethod(t *testing.T) {
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

	providerKey := "test-provider-delete"
	cleanupProvider(t, db, providerKey)
	defer cleanupProvider(t, db, providerKey)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	zoneID, err := store.CreateZone(ctx, "Test Zone Delete", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, zoneID)

	methodID, err := store.CreateMethod(ctx, Method{
		ZoneID:           zoneID,
		ProviderKey:      providerKey,
		ServiceCode:      "STANDARD",
		Title:            "Delete Test Method",
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{}`),
	})
	if err != nil {
		t.Fatalf("create method error: %v", err)
	}

	err = store.DeleteMethod(ctx, methodID)
	if err != nil {
		t.Fatalf("DeleteMethod error: %v", err)
	}

	m, err := store.GetMethod(ctx, methodID)
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows after delete, got %v", err)
	}
	if m != nil {
		t.Fatalf("expected nil method after delete")
	}
}

func TestMethodsStore_DeleteMethod_NotFound(t *testing.T) {
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

	err = store.DeleteMethod(ctx, uuid.New().String())
	if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestMethodsStore_PricingRulesJSON(t *testing.T) {
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

	providerKey := "test-provider-pricing"
	cleanupProvider(t, db, providerKey)
	defer cleanupProvider(t, db, providerKey)

	err = store.CreateProvider(ctx, providerKey, "Test Provider", "sandbox", []byte(`{}`))
	if err != nil {
		t.Fatalf("create provider error: %v", err)
	}

	zoneID, err := store.CreateZone(ctx, "Test Zone Pricing", []byte(`["LT"]`))
	if err != nil {
		t.Fatalf("create zone error: %v", err)
	}
	defer cleanupZone(t, db, zoneID)

	pricingRules := map[string]interface{}{
		"price":               5.99,
		"free_shipping_above": 100.00,
		"min_weight":          0.5,
		"max_weight":          30.0,
	}
	pricingJSON, _ := json.Marshal(pricingRules)

	methodID, err := store.CreateMethod(ctx, Method{
		ZoneID:           zoneID,
		ProviderKey:      providerKey,
		ServiceCode:      "STANDARD",
		Title:            "Pricing Test Method",
		PricingMode:      "fixed",
		PricingRulesJSON: pricingJSON,
	})
	if err != nil {
		t.Fatalf("create method error: %v", err)
	}
	defer cleanupMethod(t, db, methodID)

	m, err := store.GetMethod(ctx, methodID)
	if err != nil {
		t.Fatalf("GetMethod error: %v", err)
	}

	var retrieved map[string]interface{}
	if err := json.Unmarshal(m.PricingRulesJSON, &retrieved); err != nil {
		t.Fatalf("unmarshal pricing rules error: %v", err)
	}

	if retrieved["price"] != pricingRules["price"] {
		t.Fatalf("expected price %v, got %v", pricingRules["price"], retrieved["price"])
	}
	if retrieved["free_shipping_above"] != pricingRules["free_shipping_above"] {
		t.Fatalf("expected free_shipping_above %v, got %v", pricingRules["free_shipping_above"], retrieved["free_shipping_above"])
	}
}

func cleanupMethod(t *testing.T, db *sql.DB, id string) {
	ctx := context.Background()
	_, err := db.ExecContext(ctx, "DELETE FROM shipping_methods WHERE id = $1", id)
	if err != nil {
		t.Logf("cleanup error for method id %q: %v", id, err)
	}
}
