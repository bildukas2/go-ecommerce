package shipping

import (
	"context"
	"database/sql"
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
		ID:               "test-id",
		PricingMode:      "flat",
		PricingRulesJSON: []byte(`{"price": 250}`),
	}

	price := calculateMethodPrice(method, 0, 0, false)

	if price != 250 {
		t.Errorf("expected price 250, got %d", price)
	}
}

func TestCalculateMethodPrice_FixedMode_WithFreeShipping(t *testing.T) {
	method := &shipping.Method{
		ID:               "test-id",
		PricingMode:      "flat",
		PricingRulesJSON: []byte(`{"price": 250, "freeOver": 10000}`),
	}

	price := calculateMethodPrice(method, 15000, 0, false)

	if price != 0 {
		t.Errorf("expected price 0, got %d", price)
	}
}

func TestCalculateMethodPrice_FixedMode_BelowFreeShippingThreshold(t *testing.T) {
	method := &shipping.Method{
		ID:               "test-id",
		PricingMode:      "flat",
		PricingRulesJSON: []byte(`{"price": 250, "freeOver": 10000}`),
	}

	price := calculateMethodPrice(method, 5000, 0, false)

	if price != 250 {
		t.Errorf("expected price 250, got %d", price)
	}
}

func TestCalculateMethodPrice_TableMode(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "weight_tiers",
		PricingRulesJSON: []byte(`{
			"tiers": [
				{"min": 0, "max": 1, "price": 250},
				{"min": 1, "max": 5, "price": 350}
			]
		}`),
	}

	price := calculateMethodPrice(method, 0, 1.5, true)

	if price != 350 {
		t.Errorf("expected price 350, got %d", price)
	}
}

func TestCalculateMethodPrice_InvalidJSON(t *testing.T) {
	method := &shipping.Method{
		ID:               "test-id",
		PricingMode:      "flat",
		PricingRulesJSON: []byte(`invalid json`),
	}

	price := calculateMethodPrice(method, 0, 0, false)

	if price != 0 {
		t.Errorf("expected price 0 for invalid json, got %d", price)
	}
}

func TestCalculateMethodPrice_EmptyRules(t *testing.T) {
	method := &shipping.Method{
		ID:               "test-id",
		PricingMode:      "flat",
		PricingRulesJSON: []byte(`{}`),
	}

	price := calculateMethodPrice(method, 0, 0, false)

	if price != 0 {
		t.Errorf("expected price 0 for empty rules, got %d", price)
	}
}

func TestCalculateMethodPrice_FreeMode_Always(t *testing.T) {
	method := &shipping.Method{
		ID:               "test-id",
		PricingMode:      "free",
		PricingRulesJSON: []byte(`{"always": true}`),
	}

	price := calculateMethodPrice(method, 0, 0, false)

	if price != 0 {
		t.Errorf("expected price 0, got %d", price)
	}
}

func TestCalculateMethodPrice_TotalTiers(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "total_tiers",
		PricingRulesJSON: []byte(`{
			"tiers": [
				{"min": 0, "max": 5000, "price": 499},
				{"min": 5000, "max": 10000, "price": 299},
				{"min": 10000, "price": 0}
			]
		}`),
	}

	if got := calculateMethodPrice(method, 4999, 0, false); got != 499 {
		t.Fatalf("expected 499 below boundary, got %d", got)
	}
	if got := calculateMethodPrice(method, 5000, 0, false); got != 299 {
		t.Fatalf("expected 299 at boundary, got %d", got)
	}
	if got := calculateMethodPrice(method, 10000, 0, false); got != 0 {
		t.Fatalf("expected 0 at top tier, got %d", got)
	}
}

func TestCalculateMethodPrice_WeightTiers_UsesCartWeight(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "weight_tiers",
		PricingRulesJSON: []byte(`{
			"tiers": [
				{"min": 0, "max": 2, "price": 399},
				{"min": 2, "max": 5, "price": 599},
				{"min": 5, "price": 899}
			]
		}`),
	}

	if got := calculateMethodPrice(method, 0, 1.99, true); got != 399 {
		t.Fatalf("expected 399, got %d", got)
	}
	if got := calculateMethodPrice(method, 0, 2, true); got != 599 {
		t.Fatalf("expected 599 at boundary, got %d", got)
	}
	if got := calculateMethodPrice(method, 0, 6, true); got != 899 {
		t.Fatalf("expected 899 top tier, got %d", got)
	}
}

func TestCalculateMethodPrice_ProviderMode_ApplyMarkupAndClamp(t *testing.T) {
	method := &shipping.Method{
		ID:          "test-id",
		PricingMode: "provider",
		PricingRulesJSON: []byte(`{
			"markupFixed": 100,
			"markupPercent": 5,
			"minPrice": 300,
			"maxPrice": 3000
		}`),
	}

	price := calculateMethodPrice(method, 0, 0, false)
	if price != 300 {
		t.Fatalf("expected 300 from min clamp, got %d", price)
	}
}

func TestCalculateMethodPrice_LegacyFixedAndTableCompatibility(t *testing.T) {
	fixed := &shipping.Method{
		ID:               "legacy-fixed",
		PricingMode:      "fixed",
		PricingRulesJSON: []byte(`{"base_price_cents": 250, "free_shipping_order_min_cents": 10000}`),
	}
	if got := calculateMethodPrice(fixed, 5000, 0, false); got != 250 {
		t.Fatalf("expected legacy fixed 250, got %d", got)
	}
	if got := calculateMethodPrice(fixed, 10000, 0, false); got != 0 {
		t.Fatalf("expected legacy fixed free over threshold, got %d", got)
	}

	table := &shipping.Method{
		ID:          "legacy-table",
		PricingMode: "table",
		PricingRulesJSON: []byte(`{
			"rules": [
				{"min_weight_kg": 0, "max_weight_kg": 2, "price_cents": 399},
				{"min_weight_kg": 2, "price_cents": 599}
			]
		}`),
	}
	if got := calculateMethodPrice(table, 0, 3, true); got != 599 {
		t.Fatalf("expected legacy table 599, got %d", got)
	}
}

func TestHandleStorefrontShippingOptions_InvalidCartWeight(t *testing.T) {
	m := &module{store: &mockStore{}}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/shipping/options?country=LT&cart_weight_kg=bad", nil)

	m.handleStorefrontShippingOptions(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestHandleStorefrontShippingOptions_WeightTierUsesQueryWeight(t *testing.T) {
	m := &module{
		store: &mockStore{
			getZoneByCountryFunc: func(ctx context.Context, country string) (*shipping.Zone, error) {
				return &shipping.Zone{
					ID:            "zone-1",
					Name:          "LT",
					CountriesJSON: []byte(`["LT"]`),
					Enabled:       true,
				}, nil
			},
			listMethodsByZoneFunc: func(ctx context.Context, zoneID string) ([]shipping.Method, error) {
				return []shipping.Method{
					{
						ID:          "method-1",
						ZoneID:      zoneID,
						ProviderKey: "omniva",
						ServiceCode: "PICKUP_LT",
						Title:       "Locker",
						Enabled:     true,
						PricingMode: "weight_tiers",
						PricingRulesJSON: []byte(`{
							"tiers": [
								{"min": 0, "max": 2, "price": 399},
								{"min": 2, "price": 599}
							]
						}`),
					},
				}, nil
			},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/shipping/options?country=LT&cart_weight_kg=3", nil)
	m.handleStorefrontShippingOptions(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var payload shippingOptionsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(payload.Methods) != 1 {
		t.Fatalf("expected 1 method, got %d", len(payload.Methods))
	}
	if payload.Methods[0].Price != 599 {
		t.Fatalf("expected method price 599, got %d", payload.Methods[0].Price)
	}
}

func TestHandleStorefrontShippingOptions_NoZoneReturnsEmpty(t *testing.T) {
	m := &module{
		store: &mockStore{
			getZoneByCountryFunc: func(ctx context.Context, country string) (*shipping.Zone, error) {
				return nil, sql.ErrNoRows
			},
		},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/shipping/options?country=LT", nil)

	m.handleStorefrontShippingOptions(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var payload shippingOptionsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if payload.Zone != nil {
		t.Fatalf("expected nil zone")
	}
	if len(payload.Methods) != 0 {
		t.Fatalf("expected no methods, got %d", len(payload.Methods))
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
