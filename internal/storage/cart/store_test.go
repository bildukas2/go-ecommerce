package cart

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	platformdb "goecommerce/internal/platform/db"
	storcustomers "goecommerce/internal/storage/customers"
)

func TestResolveCustomerCartMergesGuestCartAdditivelyAndIdempotently(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping cart merge integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertRelationExists(t, ctx, db, "carts")
	assertRelationExists(t, ctx, db, "customers")
	assertRelationExists(t, ctx, db, "cart_items")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("cart store init: %v", err)
	}
	customerStore, err := storcustomers.NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customer store init: %v", err)
	}

	customer := createTestCustomer(t, ctx, customerStore)
	variantID := lookupVariantID(t, ctx, db)

	guestCart, err := store.CreateCart(ctx)
	if err != nil {
		t.Fatalf("create guest cart: %v", err)
	}
	if _, err := store.AddItem(ctx, guestCart.ID, variantID, 2, nil); err != nil {
		t.Fatalf("add guest item: %v", err)
	}

	customerCart, err := store.ResolveCustomerCart(ctx, customer.ID, "")
	if err != nil {
		t.Fatalf("create customer cart: %v", err)
	}
	if _, err := store.AddItem(ctx, customerCart.ID, variantID, 1, nil); err != nil {
		t.Fatalf("add customer item: %v", err)
	}

	merged, err := store.ResolveCustomerCart(ctx, customer.ID, guestCart.ID)
	if err != nil {
		t.Fatalf("merge guest into customer cart: %v", err)
	}
	if merged.ID != customerCart.ID {
		t.Fatalf("expected canonical customer cart %s, got %s", customerCart.ID, merged.ID)
	}
	if merged.Totals.ItemCount != 3 {
		t.Fatalf("expected merged quantity 3, got %d", merged.Totals.ItemCount)
	}

	mergedAgain, err := store.ResolveCustomerCart(ctx, customer.ID, guestCart.ID)
	if err != nil {
		t.Fatalf("repeat merge guest into customer cart: %v", err)
	}
	if mergedAgain.Totals.ItemCount != 3 {
		t.Fatalf("expected idempotent quantity 3, got %d", mergedAgain.Totals.ItemCount)
	}

	guestAfterMerge, err := store.GetCart(ctx, guestCart.ID)
	if err != nil {
		t.Fatalf("get guest cart after merge: %v", err)
	}
	if guestAfterMerge.Totals.ItemCount != 0 {
		t.Fatalf("expected guest cart to be emptied after merge, got %d", guestAfterMerge.Totals.ItemCount)
	}
}

func assertRelationExists(t *testing.T, ctx context.Context, db *sql.DB, name string) {
	t.Helper()
	var regclass *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public."+name+"')").Scan(&regclass); err != nil || regclass == nil || *regclass == "" {
		t.Skipf("%s table not present; apply migrations to run this test", name)
	}
}

func createTestCustomer(t *testing.T, ctx context.Context, store *storcustomers.Store) storcustomers.Customer {
	t.Helper()
	email := fmt.Sprintf("cart-merge-%d@example.com", time.Now().UnixNano())
	customer, err := store.CreateCustomer(ctx, email, "test-hash")
	if err != nil {
		t.Fatalf("create customer: %v", err)
	}
	return customer
}

func lookupVariantID(t *testing.T, ctx context.Context, db *sql.DB) string {
	t.Helper()
	var variantID string
	if err := db.QueryRowContext(ctx, "SELECT id FROM product_variants LIMIT 1").Scan(&variantID); err != nil {
		if err == sql.ErrNoRows {
			t.Skip("no product variants seeded; skipping")
		}
		t.Fatalf("query variant: %v", err)
	}
	return variantID
}
