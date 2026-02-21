package shipping

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	shipping_platform "goecommerce/internal/platform/shipping"
	"goecommerce/internal/storage/shipping"
)

func TestHandleStorefrontShippingOptions_MissingCountry(t *testing.T) {
	m := &module{store: &shipping.Store{}}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/shipping/options", nil)

	m.handleStorefrontShippingOptions(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestHandleStorefrontShippingOptions_NoStore(t *testing.T) {
	m := &module{store: nil}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/shipping/options?country=LT", nil)

	m.handleStorefrontShippingOptions(w, r)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}

func TestHandleStorefrontTerminals_MissingProvider(t *testing.T) {
	m := &module{store: &shipping.Store{}}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/shipping/terminals?country=LT", nil)

	m.handleStorefrontTerminals(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestHandleStorefrontTerminals_MissingCountry(t *testing.T) {
	m := &module{store: &shipping.Store{}}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/shipping/terminals?provider=omniva", nil)

	m.handleStorefrontTerminals(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestHandleStorefrontTerminals_NoStore(t *testing.T) {
	m := &module{store: nil}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/shipping/terminals?provider=omniva&country=LT", nil)

	m.handleStorefrontTerminals(w, r)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, w.Code)
	}
}



func TestCalculateMethodPrice_FixedMode_NoFreeShipping(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "fixed",
		PricingRulesJSON: []byte(`{"base_price_cents": 250}`),
	}

	price := calculateMethodPrice(method, 0)

	if price != 250 {
		t.Errorf("expected price 250, got %d", price)
	}
}

func TestCalculateMethodPrice_FixedMode_WithFreeShipping(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "fixed",
		PricingRulesJSON: []byte(`{"base_price_cents": 250, "free_shipping_order_min_cents": 10000}`),
	}

	price := calculateMethodPrice(method, 15000)

	if price != 0 {
		t.Errorf("expected price 0, got %d", price)
	}
}

func TestCalculateMethodPrice_FixedMode_BelowFreeShippingThreshold(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "fixed",
		PricingRulesJSON: []byte(`{"base_price_cents": 250, "free_shipping_order_min_cents": 10000}`),
	}

	price := calculateMethodPrice(method, 5000)

	if price != 250 {
		t.Errorf("expected price 250, got %d", price)
	}
}

func TestCalculateMethodPrice_TableMode(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "table",
		PricingRulesJSON: []byte(`{
			"rules": [
				{"min_weight_kg": 0, "max_weight_kg": 1, "price_cents": 250},
				{"min_weight_kg": 1, "max_weight_kg": 5, "price_cents": 350}
			]
		}`),
	}

	price := calculateMethodPrice(method, 0)

	if price != 250 {
		t.Errorf("expected price 250, got %d", price)
	}
}

func TestCalculateMethodPrice_InvalidJSON(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "fixed",
		PricingRulesJSON: []byte(`invalid json`),
	}

	price := calculateMethodPrice(method, 0)

	if price != 0 {
		t.Errorf("expected price 0 for invalid json, got %d", price)
	}
}

func TestCalculateMethodPrice_EmptyRules(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "fixed",
		PricingRulesJSON: []byte(`{}`),
	}

	price := calculateMethodPrice(method, 0)

	if price != 0 {
		t.Errorf("expected price 0 for empty rules, got %d", price)
	}
}

func TestShippingOptionsResponse_JSON(t *testing.T) {
	response := shippingOptionsResponse{
		Zone: &zoneDTO{
			ID:        "zone-123",
			Name:      "Baltic",
			Countries: []string{"LT", "LV"},
			Enabled:   true,
		},
		Methods: []methodDTO{
			{
				ID:          "method-1",
				ZoneID:      "zone-123",
				ProviderKey: "omniva",
				ServiceCode: "PICKUP_LT",
				Title:       "Omniva Parcel Locker",
				Enabled:     true,
				SortOrder:   0,
				PricingMode: "fixed",
				Price:       250,
				Currency:    "EUR",
			},
		},
	}

	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("error marshaling response: %v", err)
	}

	var decoded shippingOptionsResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("error unmarshaling response: %v", err)
	}

	if decoded.Zone.ID != "zone-123" {
		t.Errorf("expected zone id zone-123, got %s", decoded.Zone.ID)
	}
	if len(decoded.Methods) != 1 {
		t.Errorf("expected 1 method, got %d", len(decoded.Methods))
	}
}

func TestTerminalsResponse_JSON(t *testing.T) {
	response := terminalsResponse{
		Provider: "omniva",
		Country:  "LT",
		Terminals: []shipping_platform.Terminal{
			{
				ID:   "terminal-1",
				Name: "Vilnius Central",
			},
		},
	}

	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("error marshaling response: %v", err)
	}

	if len(data) == 0 {
		t.Error("expected non-empty json")
	}
}
