package admin

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	stororders "goecommerce/internal/storage/orders"
)

type fakeOrdersStore struct {
	getMetricsFn        func(context.Context) (stororders.OrderMetrics, error)
	listOrdersFn        func(context.Context, int, int) ([]stororders.Order, error)
	getOrderByIDFn      func(context.Context, string) (stororders.Order, error)
	updateOrderStatusFn func(context.Context, string, string) error
}

func (f *fakeOrdersStore) GetOrderMetrics(ctx context.Context) (stororders.OrderMetrics, error) {
	if f.getMetricsFn == nil {
		return stororders.OrderMetrics{}, nil
	}
	return f.getMetricsFn(ctx)
}

func (f *fakeOrdersStore) ListOrders(ctx context.Context, limit, offset int) ([]stororders.Order, error) {
	if f.listOrdersFn == nil {
		return []stororders.Order{}, nil
	}
	return f.listOrdersFn(ctx, limit, offset)
}

func (f *fakeOrdersStore) GetOrderByID(ctx context.Context, id string) (stororders.Order, error) {
	if f.getOrderByIDFn == nil {
		return stororders.Order{}, sql.ErrNoRows
	}
	return f.getOrderByIDFn(ctx, id)
}

func (f *fakeOrdersStore) UpdateOrderStatus(ctx context.Context, id string, status string) error {
	if f.updateOrderStatusFn == nil {
		return nil
	}
	return f.updateOrderStatusFn(ctx, id, status)
}

func TestAdminOrderDetailReturnsStructuredPayload(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	store := &fakeOrdersStore{
		getOrderByIDFn: func(_ context.Context, id string) (stororders.Order, error) {
			if id != "order-1" {
				t.Fatalf("unexpected id %q", id)
			}
			return stororders.Order{
				ID:                  "order-1",
				Number:              "ORD-123",
				Status:              "pending_payment",
				Currency:            "USD",
				SubtotalCents:       1000,
				ShippingCents:       500,
				TaxCents:            100,
				TotalCents:          1600,
				CreatedAt:           now,
				UpdatedAt:           now,
				CustomerID:          "cust-1",
				CustomerEmail:       "buyer@example.com",
				CustomerPhone:       "+15550000000",
				CustomerFirstName:   "Alex",
				CustomerLastName:    "Mason",
				ShippingMethodID:    "sm-1",
				ShippingMethodTitle: "Courier Delivery",
				ShippingProviderKey: "omniva",
				ShippingServiceCode: "parcel",
				ShippingTerminalID:  "T-42",
				ShippingPriceCents:  500,
				ShippingFullName:    "Alex Mason",
				ShippingPhone:       "+15550000000",
				ShippingAddress1:    "Main St 1",
				ShippingAddress2:    "Apt 2",
				ShippingCity:        "Austin",
				ShippingState:       "TX",
				ShippingPostcode:    "73301",
				ShippingCountry:     "US",
				BillingFullName:     "Alex Mason",
				BillingAddress1:     "Main St 1",
				BillingAddress2:     "Apt 2",
				BillingCity:         "Austin",
				BillingState:        "TX",
				BillingPostcode:     "73301",
				BillingCountry:      "US",
				CompanyName:         "Acme Inc",
				CompanyVAT:          "US12345",
				InvoiceEmail:        "billing@example.com",
				PaymentMethod:       "cash_on_delivery",
				PaymentProvider:     "manual",
				Items: []stororders.OrderItem{
					{
						ID:                "item-1",
						OrderID:           "order-1",
						ProductVariantID:  "var-1",
						UnitPriceCents:    1000,
						Currency:          "USD",
						Quantity:          1,
						ProductTitle:      "Classic Tee",
						VariantSKU:        "TEE-BLK-M",
						VariantAttrsJSON:  []byte(`{"color":"black","size":"M"}`),
						CustomOptionsJSON: []byte(`[{"title":"Gift wrap","type":"checkbox","value_titles":["Yes"]}]`),
						CreatedAt:         now,
						UpdatedAt:         now,
					},
				},
			}, nil
		},
	}
	m := &module{orders: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/orders/order-1", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	order := payload["order"].(map[string]any)
	customer := payload["customer"].(map[string]any)
	shipping := payload["shipping"].(map[string]any)
	billing := payload["billing"].(map[string]any)
	payment := payload["payment"].(map[string]any)
	items := payload["items"].([]any)
	item := items[0].(map[string]any)

	if order["number"] != "ORD-123" || order["total_cents"] != float64(1600) {
		t.Fatalf("unexpected order payload: %#v", order)
	}
	if customer["email"] != "buyer@example.com" || customer["id"] != "cust-1" {
		t.Fatalf("unexpected customer payload: %#v", customer)
	}
	if shipping["method_title"] != "Courier Delivery" || shipping["terminal_id"] != "T-42" {
		t.Fatalf("unexpected shipping payload: %#v", shipping)
	}
	if billing["invoice_email"] != "billing@example.com" || billing["company_name"] != "Acme Inc" {
		t.Fatalf("unexpected billing payload: %#v", billing)
	}
	if payment["method"] != "cash_on_delivery" || payment["provider"] != "manual" {
		t.Fatalf("unexpected payment payload: %#v", payment)
	}
	if item["product_title"] != "Classic Tee" || item["variant_sku"] != "TEE-BLK-M" {
		t.Fatalf("unexpected item payload: %#v", item)
	}
	if _, ok := item["variant_attributes_json"].(map[string]any); !ok {
		t.Fatalf("expected variant_attributes_json object, got %#v", item["variant_attributes_json"])
	}
	if _, ok := item["custom_options_json"].([]any); !ok {
		t.Fatalf("expected custom_options_json array, got %#v", item["custom_options_json"])
	}
}

func TestAdminOrderDetailNotFound(t *testing.T) {
	store := &fakeOrdersStore{
		getOrderByIDFn: func(_ context.Context, _ string) (stororders.Order, error) {
			return stororders.Order{}, sql.ErrNoRows
		},
	}
	m := &module{orders: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/orders/missing", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)

	if res.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, res.Code)
	}
}
