package customers

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	platformdb "goecommerce/internal/platform/db"
)

func TestFavoritesDuplicateSafeAndCustomerScoped(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customers")
	assertTableExists(t, ctx, db, "customer_favorites")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}
	productID := lookupProductID(t, ctx, db)

	c1, err := store.CreateCustomer(ctx, fmt.Sprintf("fav-c1-%d@example.com", time.Now().UnixNano()), "hash-c1")
	if err != nil {
		t.Fatalf("create customer 1: %v", err)
	}
	c2, err := store.CreateCustomer(ctx, fmt.Sprintf("fav-c2-%d@example.com", time.Now().UnixNano()), "hash-c2")
	if err != nil {
		t.Fatalf("create customer 2: %v", err)
	}

	created, err := store.AddFavorite(ctx, c1.ID, productID)
	if err != nil {
		t.Fatalf("add favorite first: %v", err)
	}
	if !created {
		t.Fatalf("expected first add favorite to create row")
	}
	createdAgain, err := store.AddFavorite(ctx, c1.ID, productID)
	if err != nil {
		t.Fatalf("add favorite duplicate: %v", err)
	}
	if createdAgain {
		t.Fatalf("expected duplicate favorite insert to be no-op")
	}

	c1Favorites, err := store.ListFavorites(ctx, c1.ID, 1, 20)
	if err != nil {
		t.Fatalf("list customer 1 favorites: %v", err)
	}
	if len(c1Favorites.Items) != 1 {
		t.Fatalf("expected customer 1 favorites count 1, got %d", len(c1Favorites.Items))
	}
	if c1Favorites.Items[0].ProductID != productID {
		t.Fatalf("expected favorite product %s, got %s", productID, c1Favorites.Items[0].ProductID)
	}

	c2Favorites, err := store.ListFavorites(ctx, c2.ID, 1, 20)
	if err != nil {
		t.Fatalf("list customer 2 favorites: %v", err)
	}
	if len(c2Favorites.Items) != 0 {
		t.Fatalf("expected customer 2 favorites count 0, got %d", len(c2Favorites.Items))
	}
}

func TestListOrdersByCustomerScopedAndIncludesItemSummaries(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customers")
	assertTableExists(t, ctx, db, "orders")
	assertTableExists(t, ctx, db, "order_items")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}
	c1, err := store.CreateCustomer(ctx, fmt.Sprintf("ord-c1-%d@example.com", time.Now().UnixNano()), "hash-c1")
	if err != nil {
		t.Fatalf("create customer 1: %v", err)
	}
	c2, err := store.CreateCustomer(ctx, fmt.Sprintf("ord-c2-%d@example.com", time.Now().UnixNano()), "hash-c2")
	if err != nil {
		t.Fatalf("create customer 2: %v", err)
	}

	variantID, unitPrice, currency := lookupVariantForOrder(t, ctx, db)
	o1 := insertTestOrder(t, ctx, db, c1.ID)
	insertTestOrderItem(t, ctx, db, o1, variantID, unitPrice, currency)
	o2 := insertTestOrder(t, ctx, db, c2.ID)
	insertTestOrderItem(t, ctx, db, o2, variantID, unitPrice, currency)

	c1Orders, err := store.ListOrdersByCustomer(ctx, c1.ID, 1, 20)
	if err != nil {
		t.Fatalf("list customer 1 orders: %v", err)
	}
	if len(c1Orders.Items) != 1 {
		t.Fatalf("expected customer 1 orders count 1, got %d", len(c1Orders.Items))
	}
	if c1Orders.Items[0].ID != o1 {
		t.Fatalf("expected order %s, got %s", o1, c1Orders.Items[0].ID)
	}
	if len(c1Orders.Items[0].Items) == 0 {
		t.Fatalf("expected order item summaries")
	}
	if c1Orders.Items[0].Items[0].Quantity != 2 {
		t.Fatalf("expected quantity 2, got %d", c1Orders.Items[0].Items[0].Quantity)
	}
}

func TestUpdatePasswordAndRevokeSessions(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customers")
	assertTableExists(t, ctx, db, "customer_sessions")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}
	customer, err := store.CreateCustomer(ctx, fmt.Sprintf("pwd-%d@example.com", time.Now().UnixNano()), "old-hash")
	if err != nil {
		t.Fatalf("create customer: %v", err)
	}
	if _, err := store.CreateSession(ctx, customer.ID, fmt.Sprintf("tok-a-%d", time.Now().UnixNano()), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("create session a: %v", err)
	}
	if _, err := store.CreateSession(ctx, customer.ID, fmt.Sprintf("tok-b-%d", time.Now().UnixNano()), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("create session b: %v", err)
	}

	if err := store.UpdatePasswordAndRevokeSessions(ctx, customer.ID, "new-hash"); err != nil {
		t.Fatalf("update password and revoke sessions: %v", err)
	}

	var gotHash string
	if err := db.QueryRowContext(ctx, "SELECT password_hash FROM customers WHERE id = $1", customer.ID).Scan(&gotHash); err != nil {
		t.Fatalf("query password hash: %v", err)
	}
	if gotHash != "new-hash" {
		t.Fatalf("expected updated hash new-hash, got %s", gotHash)
	}

	var activeSessions int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM customer_sessions WHERE customer_id = $1 AND revoked_at IS NULL", customer.ID).Scan(&activeSessions); err != nil {
		t.Fatalf("count active sessions: %v", err)
	}
	if activeSessions != 0 {
		t.Fatalf("expected zero active sessions after password change, got %d", activeSessions)
	}
}

func assertTableExists(t *testing.T, ctx context.Context, db *sql.DB, name string) {
	t.Helper()
	var regclass *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public."+name+"')").Scan(&regclass); err != nil || regclass == nil || *regclass == "" {
		t.Skipf("%s table not present; apply migrations to run this test", name)
	}
}

func lookupProductID(t *testing.T, ctx context.Context, db *sql.DB) string {
	t.Helper()
	var productID string
	if err := db.QueryRowContext(ctx, "SELECT id FROM products LIMIT 1").Scan(&productID); err != nil {
		if err == sql.ErrNoRows {
			t.Skip("no products seeded; skipping")
		}
		t.Fatalf("lookup product id: %v", err)
	}
	return productID
}

func lookupVariantForOrder(t *testing.T, ctx context.Context, db *sql.DB) (string, int, string) {
	t.Helper()
	var (
		variantID string
		price     int
		currency  string
	)
	if err := db.QueryRowContext(ctx, "SELECT id, price_cents, currency FROM product_variants LIMIT 1").Scan(&variantID, &price, &currency); err != nil {
		if err == sql.ErrNoRows {
			t.Skip("no product variants seeded; skipping")
		}
		t.Fatalf("lookup variant: %v", err)
	}
	return variantID, price, currency
}

func insertTestOrder(t *testing.T, ctx context.Context, db *sql.DB, customerID string) string {
	t.Helper()
	var orderID string
	number := fmt.Sprintf("ORD-T-%d", time.Now().UnixNano())
	if err := db.QueryRowContext(ctx, `
		INSERT INTO orders (number, status, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, customer_id)
		VALUES ($1, 'pending_payment', 'USD', 1000, 0, 0, 1000, $2)
		RETURNING id
	`, number, customerID).Scan(&orderID); err != nil {
		t.Fatalf("insert test order: %v", err)
	}
	return orderID
}

func insertTestOrderItem(t *testing.T, ctx context.Context, db *sql.DB, orderID, variantID string, unitPrice int, currency string) {
	t.Helper()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO order_items (order_id, product_variant_id, unit_price_cents, currency, quantity)
		VALUES ($1, $2, $3, $4, 2)
	`, orderID, variantID, unitPrice, currency); err != nil {
		t.Fatalf("insert test order item: %v", err)
	}
}
