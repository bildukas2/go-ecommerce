package shipping

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	shipping_platform "goecommerce/internal/platform/shipping"
)

type mockProvider struct {
	listTerminalsFunc func(ctx context.Context, country string) ([]shipping_platform.Terminal, error)
	quoteFunc         func(ctx context.Context, req shipping_platform.QuoteRequest) ([]shipping_platform.ShippingOption, error)
}

func (m *mockProvider) ListTerminals(ctx context.Context, country string) ([]shipping_platform.Terminal, error) {
	if m.listTerminalsFunc != nil {
		return m.listTerminalsFunc(ctx, country)
	}
	return []shipping_platform.Terminal{}, nil
}

func (m *mockProvider) Quote(ctx context.Context, req shipping_platform.QuoteRequest) ([]shipping_platform.ShippingOption, error) {
	if m.quoteFunc != nil {
		return m.quoteFunc(ctx, req)
	}
	return []shipping_platform.ShippingOption{}, nil
}

func TestHandleDebugOmnivaPing_ProviderNotInitialized(t *testing.T) {
	m := &module{
		providers: map[string]shipping_platform.Provider{},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/debug/shipping/omniva/ping", nil)

	m.handleDebugOmnivaPing(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response pingResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.Status != "unavailable" {
		t.Errorf("expected status unavailable, got %s", response.Status)
	}
}

func TestHandleDebugOmnivaPing_ProviderNil(t *testing.T) {
	m := &module{
		providers: map[string]shipping_platform.Provider{
			"omniva": nil,
		},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/debug/shipping/omniva/ping", nil)

	m.handleDebugOmnivaPing(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response pingResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.Status != "error" {
		t.Errorf("expected status error, got %s", response.Status)
	}
}

func TestHandleDebugOmnivaPing_ProviderReady(t *testing.T) {
	m := &module{
		providers: map[string]shipping_platform.Provider{
			"omniva": &mockProvider{},
		},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/debug/shipping/omniva/ping", nil)

	m.handleDebugOmnivaPing(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response pingResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.Status != "ok" {
		t.Errorf("expected status ok, got %s", response.Status)
	}
}

func TestHandleDebugOmnivaPing_MethodNotAllowed(t *testing.T) {
	m := &module{
		providers: map[string]shipping_platform.Provider{},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("POST", "/debug/shipping/omniva/ping", nil)

	m.handleDebugOmnivaPing(w, r)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}
}

func TestHandleDebugOmnivaNTerminals_MissingCountry(t *testing.T) {
	m := &module{
		providers: map[string]shipping_platform.Provider{},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/debug/shipping/omniva/terminals", nil)

	m.handleDebugOmnivaNTerminals(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestHandleDebugOmnivaNTerminals_ProviderNotFound(t *testing.T) {
	m := &module{
		providers: map[string]shipping_platform.Provider{},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/debug/shipping/omniva/terminals?country=LT", nil)

	m.handleDebugOmnivaNTerminals(w, r)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestHandleDebugOmnivaNTerminals_Success(t *testing.T) {
	m := &module{
		providers: map[string]shipping_platform.Provider{
			"omniva": &mockProvider{
				listTerminalsFunc: func(ctx context.Context, country string) ([]shipping_platform.Terminal, error) {
					return []shipping_platform.Terminal{
						{
							ID:      "term-1",
							Name:    "Vilnius Central",
							Country: "LT",
							City:    "Vilnius",
						},
					}, nil
				},
			},
		},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/debug/shipping/omniva/terminals?country=LT", nil)

	m.handleDebugOmnivaNTerminals(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response debugTerminalsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response.Provider != "omniva" {
		t.Errorf("expected provider omniva, got %s", response.Provider)
	}

	if response.Country != "LT" {
		t.Errorf("expected country LT, got %s", response.Country)
	}

	if len(response.Terminals) != 1 {
		t.Errorf("expected 1 terminal, got %d", len(response.Terminals))
	}

	if response.Terminals[0]["name"] != "Vilnius Central" {
		t.Errorf("expected terminal name Vilnius Central, got %v", response.Terminals[0]["name"])
	}
}

func TestHandleDebugOmnivaNTerminals_MethodNotAllowed(t *testing.T) {
	m := &module{
		providers: map[string]shipping_platform.Provider{},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("POST", "/debug/shipping/omniva/terminals?country=LT", nil)

	m.handleDebugOmnivaNTerminals(w, r)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}
}

func TestHandleDebugOmnivaNTerminals_MultipleTerminals(t *testing.T) {
	terminals := []shipping_platform.Terminal{
		{ID: "term-1", Name: "Vilnius Central", Country: "LT"},
		{ID: "term-2", Name: "Vilnius Airport", Country: "LT"},
		{ID: "term-3", Name: "Kaunas Station", Country: "LT"},
	}

	m := &module{
		providers: map[string]shipping_platform.Provider{
			"omniva": &mockProvider{
				listTerminalsFunc: func(ctx context.Context, country string) ([]shipping_platform.Terminal, error) {
					return terminals, nil
				},
			},
		},
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/debug/shipping/omniva/terminals?country=LT", nil)

	m.handleDebugOmnivaNTerminals(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response debugTerminalsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if len(response.Terminals) != 3 {
		t.Errorf("expected 3 terminals, got %d", len(response.Terminals))
	}
}

func TestPingResponse_JSON(t *testing.T) {
	response := pingResponse{
		Status:  "ok",
		Message: "Omniva provider is configured and ready",
	}

	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("error marshaling response: %v", err)
	}

	var decoded pingResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("error unmarshaling response: %v", err)
	}

	if decoded.Status != "ok" {
		t.Errorf("expected status ok, got %s", decoded.Status)
	}
}

func TestDebugTerminalsResponse_JSON(t *testing.T) {
	response := debugTerminalsResponse{
		Provider: "omniva",
		Country:  "LT",
		Terminals: []map[string]interface{}{
			{"id": "term-1", "name": "Terminal 1"},
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
