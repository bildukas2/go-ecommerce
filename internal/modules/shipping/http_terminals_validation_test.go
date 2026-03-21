package shipping

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	shipping_platform "goecommerce/internal/platform/shipping"
)

func TestHandleAdminTerminals_GetLPExpressCached(t *testing.T) {
	cached := []shipping_platform.Terminal{{ID: "lp-1", Name: "LP Vilnius", Country: "LT", City: "Vilnius"}}
	payload, _ := json.Marshal(cached)

	m := &module{
		store: &mockStore{
			getCachedTerminalsFunc: func(ctx context.Context, providerKey, country string) ([]byte, time.Time, error) {
				if providerKey != "lpexpress" {
					t.Fatalf("expected provider lpexpress, got %s", providerKey)
				}
				if country != "LT" {
					t.Fatalf("expected country LT, got %s", country)
				}
				return payload, time.Now().UTC(), nil
			},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/admin/shipping/terminals?provider=lpexpress&country=LT", nil)
	m.handleAdminTerminals(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response["provider"] != "lpexpress" {
		t.Fatalf("expected provider lpexpress, got %v", response["provider"])
	}
	if response["country"] != "LT" {
		t.Fatalf("expected country LT, got %v", response["country"])
	}
	terminals, ok := response["terminals"].([]any)
	if !ok {
		t.Fatalf("expected terminals array, got %T", response["terminals"])
	}
	if len(terminals) != 1 {
		t.Fatalf("expected 1 terminal, got %d", len(terminals))
	}
}

func TestHandleAdminTerminals_RefreshLPExpressUpdatesCache(t *testing.T) {
	var upsertCalled bool
	var upsertProvider string
	var upsertCountry string

	m := &module{
		store: &mockStore{
			upsertCachedTerminalsFunc: func(ctx context.Context, providerKey, country string, payloadJSON []byte) error {
				upsertCalled = true
				upsertProvider = providerKey
				upsertCountry = country
				var decoded []shipping_platform.Terminal
				if err := json.Unmarshal(payloadJSON, &decoded); err != nil {
					t.Fatalf("expected terminal payload JSON, got error: %v", err)
				}
				if len(decoded) != 1 || decoded[0].ID != "lp-fresh" {
					t.Fatalf("unexpected cached payload: %+v", decoded)
				}
				return nil
			},
		},
		providers: map[string]shipping_platform.Provider{
			"lpexpress": &mockProvider{
				listTerminalsFunc: func(ctx context.Context, country string) ([]shipping_platform.Terminal, error) {
					if country != "LT" {
						t.Fatalf("expected country LT, got %s", country)
					}
					return []shipping_platform.Terminal{{ID: "lp-fresh", Name: "LP Fresh", Country: "LT", City: "Kaunas"}}, nil
				},
			},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/admin/shipping/terminals?provider=lpexpress&country=LT", nil)
	m.handleAdminTerminals(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}
	if !upsertCalled {
		t.Fatal("expected cache upsert to be called")
	}
	if upsertProvider != "lpexpress" || upsertCountry != "LT" {
		t.Fatalf("unexpected upsert args: provider=%s country=%s", upsertProvider, upsertCountry)
	}
}

func TestHandleAdminTerminals_DeleteLPExpressCache(t *testing.T) {
	var deleteCalled bool
	m := &module{
		store: &mockStore{
			deleteCachedTerminalsFunc: func(ctx context.Context, providerKey, country string) error {
				deleteCalled = true
				if providerKey != "lpexpress" {
					t.Fatalf("expected provider lpexpress, got %s", providerKey)
				}
				if country != "LT" {
					t.Fatalf("expected country LT, got %s", country)
				}
				return nil
			},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodDelete, "/admin/shipping/terminals?provider=lpexpress&country=LT", nil)
	m.handleAdminTerminals(w, r)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, w.Code)
	}
	if !deleteCalled {
		t.Fatal("expected cache delete to be called")
	}
}

func TestHandleStorefrontTerminals_LPExpressExpiredCacheRefreshes(t *testing.T) {
	oldCached := []shipping_platform.Terminal{{ID: "stale", Name: "Stale LP", Country: "LT", City: "Vilnius"}}
	cachedJSON, _ := json.Marshal(oldCached)

	var upsertCalled bool
	m := &module{
		store: &mockStore{
			getCachedTerminalsFunc: func(ctx context.Context, providerKey, country string) ([]byte, time.Time, error) {
				return cachedJSON, time.Now().Add(-25 * time.Hour), nil
			},
			upsertCachedTerminalsFunc: func(ctx context.Context, providerKey, country string, payloadJSON []byte) error {
				upsertCalled = true
				if providerKey != "lpexpress" || country != "LT" {
					t.Fatalf("unexpected upsert args provider=%s country=%s", providerKey, country)
				}
				return nil
			},
		},
		providers: map[string]shipping_platform.Provider{
			"lpexpress": &mockProvider{
				listTerminalsFunc: func(ctx context.Context, country string) ([]shipping_platform.Terminal, error) {
					return []shipping_platform.Terminal{{ID: "lp-live", Name: "LP Live", Country: "LT", City: "Klaipeda"}}, nil
				},
			},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/shipping/terminals?provider=lpexpress&country=LT", nil)
	m.handleStorefrontTerminals(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}
	if !upsertCalled {
		t.Fatal("expected expired cache flow to refresh and upsert terminals")
	}

	var response terminalsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Provider != "lpexpress" || response.Country != "LT" {
		t.Fatalf("unexpected response provider/country: %s/%s", response.Provider, response.Country)
	}
	if len(response.Terminals) != 1 || response.Terminals[0].ID != "lp-live" {
		t.Fatalf("expected refreshed LP terminal, got %+v", response.Terminals)
	}
}

func TestHandleAdminProviders_ListProviderPluginsIncludesLPExpressAndOmniva(t *testing.T) {
	m := &module{}
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/admin/shipping/providers/plugins", nil)

	m.handleAdminProviders(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	items, ok := payload["items"].([]any)
	if !ok {
		t.Fatalf("expected items array, got %T", payload["items"])
	}

	hasLPExpress := false
	hasOmniva := false
	for _, item := range items {
		obj, ok := item.(map[string]any)
		if !ok {
			continue
		}
		key, _ := obj["key"].(string)
		switch key {
		case "lpexpress":
			hasLPExpress = true
		case "omniva":
			hasOmniva = true
		}
	}

	if !hasLPExpress {
		t.Fatal("expected lpexpress plugin in response")
	}
	if !hasOmniva {
		t.Fatal("expected omniva plugin in response")
	}
}
