package orders

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	platformdb "goecommerce/internal/platform/db"
	storcart "goecommerce/internal/storage/cart"
	storcustomers "goecommerce/internal/storage/customers"
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
	if _, err := cartStore.AddItem(ctx, c.ID, variantID, 2, nil); err != nil {
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

func TestGetOrderMetrics(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping metrics test")
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

	orderStore, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("orders store init: %v", err)
	}

	// Just verify we can call it without error
	metrics, err := orderStore.GetOrderMetrics(ctx)
	if err != nil {
		t.Fatalf("GetOrderMetrics error: %v", err)
	}

	// At least 0 orders
	if metrics.TotalOrders < 0 {
		t.Fatalf("negative total orders: %d", metrics.TotalOrders)
	}
}

func TestCreateFromCartForCustomerPersistsCustomerID(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customer linkage test")
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
	customerStore, err := storcustomers.NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}

	customer, err := customerStore.CreateCustomer(ctx, fmt.Sprintf("order-link-%d@example.com", time.Now().UnixNano()), "test-hash")
	if err != nil {
		t.Fatalf("create customer: %v", err)
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
	if _, err := cartStore.AddItem(ctx, c.ID, variantID, 1, nil); err != nil {
		t.Fatalf("add item: %v", err)
	}
	c2, err := cartStore.GetCart(ctx, c.ID)
	if err != nil {
		t.Fatalf("get cart: %v", err)
	}

	order, err := orderStore.CreateFromCartForCustomer(ctx, c2, customer.ID)
	if err != nil {
		t.Fatalf("create order: %v", err)
	}

	var savedCustomerID sql.NullString
	if err := db.QueryRowContext(ctx, "SELECT customer_id::text FROM orders WHERE id = $1", order.ID).Scan(&savedCustomerID); err != nil {
		t.Fatalf("query saved order customer id: %v", err)
	}
	if !savedCustomerID.Valid || savedCustomerID.String != customer.ID {
		t.Fatalf("expected customer_id %s, got %#v", customer.ID, savedCustomerID)
	}
}

func TestUpdateOrderStatusToNewStatuses(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping status update test")
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

	orderStore, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("orders store init: %v", err)
	}

	// Find an order to update
	var orderID string
	err = db.QueryRowContext(ctx, "SELECT id FROM orders LIMIT 1").Scan(&orderID)
	if err != nil {
		if err == sql.ErrNoRows {
			t.Skip("no orders found; skipping status update test")
		}
		t.Fatalf("query order: %v", err)
	}

	newStatuses := []string{"processing", "completed", "paid", "cancelled", "pending_payment"}
	for _, status := range newStatuses {
		if err := orderStore.UpdateOrderStatus(ctx, orderID, status); err != nil {
			t.Fatalf("UpdateOrderStatus to %s failed: %v", status, err)
		}

		var savedStatus string
		if err := db.QueryRowContext(ctx, "SELECT status::text FROM orders WHERE id = $1", orderID).Scan(&savedStatus); err != nil {
			t.Fatalf("query saved status: %v", err)
		}
		if savedStatus != status {
			t.Fatalf("expected status %s, got %s", status, savedStatus)
		}
	}
}

func TestListOrdersIncludesCustomerShipmentAndPaymentFields(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping list orders summary test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	var ordersTable *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public.orders')").Scan(&ordersTable); err != nil || ordersTable == nil || *ordersTable == "" {
		t.Skip("orders table not present; apply migrations to run this test")
	}

	var customersTable *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public.customers')").Scan(&customersTable); err != nil || customersTable == nil || *customersTable == "" {
		t.Skip("customers table not present; apply migrations to run this test")
	}

	var shippingMethodsTable *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public.shipping_methods')").Scan(&shippingMethodsTable); err != nil || shippingMethodsTable == nil || *shippingMethodsTable == "" {
		t.Skip("shipping_methods table not present; apply migrations to run this test")
	}

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("orders store init: %v", err)
	}

	email := fmt.Sprintf("admin-order-summary-%d@example.com", time.Now().UnixNano())
	var customerID string
	if err := db.QueryRowContext(ctx, `
		INSERT INTO customers (email, password_hash, first_name, last_name)
		VALUES ($1, 'hash', 'Alice', 'Walker')
		RETURNING id
	`, email).Scan(&customerID); err != nil {
		t.Fatalf("insert customer: %v", err)
	}

	providerKey := fmt.Sprintf("prov-%d", time.Now().UnixNano())
	if _, err := db.ExecContext(ctx, `
		INSERT INTO shipping_providers (key, name, enabled, mode, config_json)
		VALUES ($1, 'Test Provider', true, 'sandbox', '{}'::jsonb)
	`, providerKey); err != nil {
		t.Fatalf("insert shipping provider: %v", err)
	}

	var zoneID string
	if err := db.QueryRowContext(ctx, `
		INSERT INTO shipping_zones (name, countries_json, enabled)
		VALUES ('Test Zone', '["US"]'::jsonb, true)
		RETURNING id
	`).Scan(&zoneID); err != nil {
		t.Fatalf("insert shipping zone: %v", err)
	}

	var shippingMethodID string
	if err := db.QueryRowContext(ctx, `
		INSERT INTO shipping_methods (zone_id, provider_key, service_code, title, enabled, sort_order, pricing_mode, pricing_rules_json)
		VALUES ($1, $2, 'door', 'Courier Delivery', true, 0, 'fixed', '{"base_price_cents":500}'::jsonb)
		RETURNING id
	`, zoneID, providerKey).Scan(&shippingMethodID); err != nil {
		t.Fatalf("insert shipping method: %v", err)
	}

	orderNumber := fmt.Sprintf("ORD-TST-%d", time.Now().UnixNano()%1000000)
	if _, err := db.ExecContext(ctx, `
		INSERT INTO orders (
			number, status, currency, subtotal_cents, shipping_cents, tax_cents, total_cents,
			customer_id, shipping_method_id, shipping_full_name, shipping_phone, payment_method, payment_provider
		)
		VALUES (
			$1, 'pending_payment', 'USD', 1000, 500, 0, 1500,
			$2::uuid, $3::uuid, 'Alice Walker', '+1555000111', 'cash_on_delivery', 'manual'
		)
	`, orderNumber, customerID, shippingMethodID); err != nil {
		t.Fatalf("insert order: %v", err)
	}

	orders, err := store.ListOrders(ctx, 200, 0)
	if err != nil {
		t.Fatalf("ListOrders error: %v", err)
	}

	var found *Order
	for i := range orders {
		if orders[i].Number == orderNumber {
			found = &orders[i]
			break
		}
	}
	if found == nil {
		t.Fatalf("expected inserted order %s in list", orderNumber)
	}
	if found.CustomerName != "Alice Walker" {
		t.Fatalf("expected customer name 'Alice Walker', got %q", found.CustomerName)
	}
	if found.CustomerInfo != email {
		t.Fatalf("expected customer info %q, got %q", email, found.CustomerInfo)
	}
	if found.ShipmentType != "Courier Delivery" {
		t.Fatalf("expected shipment type 'Courier Delivery', got %q", found.ShipmentType)
	}
	if found.PaymentType != "cash_on_delivery" {
		t.Fatalf("expected payment type 'cash_on_delivery', got %q", found.PaymentType)
	}
}
