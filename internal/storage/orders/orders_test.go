package orders

import (
	"context"
	"database/sql"
	"encoding/json"
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

func TestCreateFromCartPersistsOrderItemSnapshotFields(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping order item snapshot test")
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
	var orderItemsTable *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public.order_items')").Scan(&orderItemsTable); err != nil || orderItemsTable == nil || *orderItemsTable == "" {
		t.Skip("order_items table not present; apply migrations to run this test")
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

	var (
		variantID     string
		expectedTitle string
		expectedSKU   string
		expectedAttrs []byte
	)
	if err := db.QueryRowContext(ctx, `
		SELECT pv.id, p.title, pv.sku, pv.attributes_json
		FROM product_variants pv
		JOIN products p ON p.id = pv.product_id
		LIMIT 1
	`).Scan(&variantID, &expectedTitle, &expectedSKU, &expectedAttrs); err != nil {
		if err == sql.ErrNoRows {
			t.Skip("no product variants seeded; skipping")
		}
		t.Fatalf("query variant snapshot source: %v", err)
	}

	if _, err := cartStore.AddItem(ctx, c.ID, variantID, 1, nil); err != nil {
		t.Fatalf("add item: %v", err)
	}
	// Simulate a cart item with custom options and adjusted unit price.
	cartCustomOptions := []map[string]any{
		{
			"OptionID":        "22b18631-78c7-422e-8fa2-11557ab58f4b",
			"Title":           "Vardas",
			"Type":            "field",
			"ValueID":         "",
			"ValueIDs":        []string{},
			"ValueText":       "TYasdasd",
			"ValueTitle":      "",
			"ValueTitles":     []string{},
			"PriceDeltaCents": 200,
		},
		{
			"OptionID":        "4568252c-826b-421c-97e2-49c0a5c808e5",
			"Title":           "Size",
			"Type":            "radio",
			"ValueID":         "34945f9e-1f99-493d-b4b7-28647a58a879",
			"ValueIDs":        []string{},
			"ValueText":       "",
			"ValueTitle":      "X",
			"ValueTitles":     []string{},
			"PriceDeltaCents": 300,
		},
	}
	customOptionsJSON, err := json.Marshal(cartCustomOptions)
	if err != nil {
		t.Fatalf("marshal cart custom options: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		UPDATE cart_items
		SET unit_price_cents = $1, custom_options_json = $2::jsonb, updated_at = now()
		WHERE cart_id = $3::uuid AND product_variant_id = $4::uuid
	`, 3030, customOptionsJSON, c.ID, variantID); err != nil {
		t.Fatalf("update cart item custom options: %v", err)
	}
	c2, err := cartStore.GetCart(ctx, c.ID)
	if err != nil {
		t.Fatalf("get cart: %v", err)
	}

	order, err := orderStore.CreateFromCart(ctx, c2)
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	if len(order.Items) == 0 {
		t.Fatalf("expected at least one order item")
	}

	var (
		productTitle string
		variantSKU   string
		unitPrice    int
		attrsMatch   bool
		optionsJSON  []byte
	)
	if err := db.QueryRowContext(ctx, `
		SELECT
			unit_price_cents,
			product_title,
			variant_sku,
			variant_attributes_json = $2::jsonb AS attrs_match,
			custom_options_json
		FROM order_items
		WHERE id = $1::uuid
	`, order.Items[0].ID, expectedAttrs).Scan(&unitPrice, &productTitle, &variantSKU, &attrsMatch, &optionsJSON); err != nil {
		t.Fatalf("query saved order item snapshot: %v", err)
	}

	if unitPrice != 3030 {
		t.Fatalf("expected unit_price_cents %d, got %d", 3030, unitPrice)
	}
	if productTitle != expectedTitle {
		t.Fatalf("expected product_title %q, got %q", expectedTitle, productTitle)
	}
	if variantSKU != expectedSKU {
		t.Fatalf("expected variant_sku %q, got %q", expectedSKU, variantSKU)
	}
	if !attrsMatch {
		t.Fatalf("expected variant_attributes_json to match source variant attributes")
	}
	var optionsOut []map[string]any
	if err := json.Unmarshal(optionsJSON, &optionsOut); err != nil {
		t.Fatalf("decode custom_options_json: %v", err)
	}
	if len(optionsOut) != 2 {
		t.Fatalf("expected 2 custom options, got %d", len(optionsOut))
	}
	for _, option := range optionsOut {
		if _, ok := option["option_id"]; !ok {
			t.Fatalf("expected snake_case custom option keys, got %s", string(optionsJSON))
		}
		if _, ok := option["price_delta_cents"]; !ok {
			t.Fatalf("expected price_delta_cents in custom options, got %s", string(optionsJSON))
		}
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
		VALUES ($1, $2, 'door', 'Courier Delivery', true, 0, 'flat', '{"base_price_cents":500}'::jsonb)
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

func TestGetOrderByIDIncludesEnrichedAdminDetailFields(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping order detail enrichment test")
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
	var orderItemsTable *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public.order_items')").Scan(&orderItemsTable); err != nil || orderItemsTable == nil || *orderItemsTable == "" {
		t.Skip("order_items table not present; apply migrations to run this test")
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

	var variantID string
	if err := db.QueryRowContext(ctx, "SELECT id FROM product_variants LIMIT 1").Scan(&variantID); err != nil {
		if err == sql.ErrNoRows {
			t.Skip("no product variants seeded; skipping")
		}
		t.Fatalf("query variant: %v", err)
	}

	email := fmt.Sprintf("order-detail-%d@example.com", time.Now().UnixNano())
	phone := "+1555000222"
	var customerID string
	if err := db.QueryRowContext(ctx, `
		INSERT INTO customers (email, phone, password_hash, first_name, last_name)
		VALUES ($1, $2, 'hash', 'Taylor', 'Swift')
		RETURNING id
	`, email, phone).Scan(&customerID); err != nil {
		t.Fatalf("insert customer: %v", err)
	}

	providerKey := fmt.Sprintf("prov-detail-%d", time.Now().UnixNano())
	if _, err := db.ExecContext(ctx, `
		INSERT INTO shipping_providers (key, name, enabled, mode, config_json)
		VALUES ($1, 'Detail Provider', true, 'sandbox', '{}'::jsonb)
	`, providerKey); err != nil {
		t.Fatalf("insert shipping provider: %v", err)
	}

	var zoneID string
	if err := db.QueryRowContext(ctx, `
		INSERT INTO shipping_zones (name, countries_json, enabled)
		VALUES ('Detail Zone', '["US"]'::jsonb, true)
		RETURNING id
	`).Scan(&zoneID); err != nil {
		t.Fatalf("insert shipping zone: %v", err)
	}

	var shippingMethodID string
	if err := db.QueryRowContext(ctx, `
		INSERT INTO shipping_methods (zone_id, provider_key, service_code, title, enabled, sort_order, pricing_mode, pricing_rules_json)
		VALUES ($1, $2, 'parcel', 'Parcel Terminal', true, 0, 'flat', '{"price_cents":700}'::jsonb)
		RETURNING id
	`, zoneID, providerKey).Scan(&shippingMethodID); err != nil {
		t.Fatalf("insert shipping method: %v", err)
	}

	orderNumber := fmt.Sprintf("ORD-DET-%d", time.Now().UnixNano()%1000000)
	var orderID string
	if err := db.QueryRowContext(ctx, `
		INSERT INTO orders (
			number, status, currency, subtotal_cents, shipping_cents, tax_cents, total_cents,
			customer_id, shipping_method_id, shipping_terminal_id, shipping_price_cents,
			shipping_full_name, shipping_phone, shipping_address1, shipping_address2, shipping_city, shipping_state, shipping_postcode, shipping_country,
			billing_full_name, billing_address1, billing_address2, billing_city, billing_state, billing_postcode, billing_country,
			company_name, company_vat, invoice_email, payment_method, payment_provider
		) VALUES (
			$1, 'pending_payment', 'USD', 2000, 700, 100, 2800,
			$2::uuid, $3::uuid, 'TERM-99', 700,
			'Taylor Swift', '+1555000222', 'Street 1', 'Apt 9', 'Nashville', 'TN', '37201', 'US',
			'Taylor Swift', 'Street 1', 'Apt 9', 'Nashville', 'TN', '37201', 'US',
			'Swift LLC', 'US-VAT-999', 'invoice@example.com', 'cash_on_delivery', 'manual'
		)
		RETURNING id
	`, orderNumber, customerID, shippingMethodID).Scan(&orderID); err != nil {
		t.Fatalf("insert order: %v", err)
	}

	if _, err := db.ExecContext(ctx, `
		INSERT INTO order_items (
			order_id, product_variant_id, unit_price_cents, currency, quantity,
			product_title, variant_sku, variant_attributes_json, custom_options_json
		) VALUES (
			$1::uuid, $2::uuid, 2000, 'USD', 1,
			'Vintage Hoodie', 'HOOD-BLK-L', '{"color":"black","size":"L"}'::jsonb, '[{"title":"Gift","type":"checkbox","value_titles":["Yes"]}]'::jsonb
		)
	`, orderID, variantID); err != nil {
		t.Fatalf("insert order item: %v", err)
	}

	order, err := store.GetOrderByID(ctx, orderID)
	if err != nil {
		t.Fatalf("GetOrderByID error: %v", err)
	}

	if order.CustomerID != customerID || order.CustomerEmail != email || order.CustomerPhone != phone {
		t.Fatalf("unexpected customer fields: %+v", order)
	}
	if order.ShippingMethodID != shippingMethodID || order.ShippingMethodTitle != "Parcel Terminal" || order.ShippingProviderKey != providerKey || order.ShippingServiceCode != "parcel" {
		t.Fatalf("unexpected shipping method fields: %+v", order)
	}
	if order.ShippingTerminalID != "TERM-99" || order.ShippingPriceCents != 700 || order.ShippingAddress1 != "Street 1" {
		t.Fatalf("unexpected shipping address fields: %+v", order)
	}
	if order.BillingAddress1 != "Street 1" || order.CompanyName != "Swift LLC" || order.InvoiceEmail != "invoice@example.com" {
		t.Fatalf("unexpected billing/invoice fields: %+v", order)
	}
	if order.PaymentMethod != "cash_on_delivery" || order.PaymentProvider != "manual" {
		t.Fatalf("unexpected payment fields: %+v", order)
	}
	if len(order.Items) != 1 {
		t.Fatalf("expected one item, got %d", len(order.Items))
	}
	if order.Items[0].ProductTitle != "Vintage Hoodie" || order.Items[0].VariantSKU != "HOOD-BLK-L" {
		t.Fatalf("unexpected order item snapshot fields: %+v", order.Items[0])
	}
}

func TestGetWeeklyRevenueTrend(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping trend test")
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

	trend, err := orderStore.GetWeeklyRevenueTrend(ctx)
	if err != nil {
		t.Fatalf("GetWeeklyRevenueTrend error: %v", err)
	}

	if trend == nil {
		t.Fatalf("trend is nil")
	}
}

func TestGetTopProducts(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping top products test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	var regclass *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public.order_items')").Scan(&regclass); err != nil || regclass == nil || *regclass == "" {
		t.Skip("order_items table not present; apply migrations to run this test")
	}

	orderStore, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("orders store init: %v", err)
	}

	products, err := orderStore.GetTopProducts(ctx, 5)
	if err != nil {
		t.Fatalf("GetTopProducts error: %v", err)
	}

	if products == nil {
		t.Fatalf("products is nil")
	}
}
