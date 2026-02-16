package orders

import (
	"context"
	"database/sql"
	"os"
	"testing"

	platformdb "goecommerce/internal/platform/db"
	storcart "goecommerce/internal/storage/cart"
)

func TestCheckoutCreatesOrderPendingPayment(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping checkout business test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()
	var regclass *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public.orders')").Scan(&regclass); err != nil || regclass == nil || *regclass == "" {
		t.Skip("orders table not present; apply migrations to run this test")
	}

	cartStore, err := storcart.NewStore(ctx, db)
	if err != nil {
		t.Fatalf("cart store init: %v", err)
	}
	orderStore, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("orders store init: %v", err)
	}

	c, err := cartStore.CreateCart(ctx)
	if err != nil {
		t.Fatalf("create cart: %v", err)
	}
	var variantID string
	if err := db.QueryRowContext(ctx, "SELECT id FROM product_variants LIMIT 1").Scan(&variantID); err != nil {
		if err == sql.ErrNoRows {
			t.Skip("no product variants seeded; skipping")
		}
		t.Fatalf("query variant: %v", err)
	}
	if _, err := cartStore.AddItem(ctx, c.ID, variantID, 2); err != nil {
		t.Fatalf("add item: %v", err)
	}
	c2, err := cartStore.GetCart(ctx, c.ID)
	if err != nil {
		t.Fatalf("get cart: %v", err)
	}
	o, err := orderStore.CreateFromCart(ctx, c2)
	if err != nil {
		t.Fatalf("create from cart: %v", err)
	}
	if o.ID == "" {
		t.Fatalf("missing order id")
	}
	if o.Status != "pending_payment" {
		t.Fatalf("unexpected status: %s", o.Status)
	}
	if o.SubtotalCents <= 0 || o.TotalCents != o.SubtotalCents {
		t.Fatalf("totals invalid: %d %d", o.SubtotalCents, o.TotalCents)
	}
	if len(o.Items) == 0 {
		t.Fatalf("no order items")
	}
}
