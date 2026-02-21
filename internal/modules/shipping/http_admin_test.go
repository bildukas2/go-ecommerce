package shipping

import (
	"bytes"
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"goecommerce/internal/storage/shipping"
)

type mockStore struct {
	listProvidersFunc         func(ctx context.Context) ([]shipping.Provider, error)
	getProviderFunc           func(ctx context.Context, key string) (*shipping.Provider, error)
	createProviderFunc        func(ctx context.Context, key, name, mode string, configJSON []byte) error
	updateProviderFunc        func(ctx context.Context, key string, enabled bool, mode string, configJSON []byte) error
	deleteProviderFunc        func(ctx context.Context, key string) error
	listZonesFunc             func(ctx context.Context) ([]shipping.Zone, error)
	getZoneFunc               func(ctx context.Context, id string) (*shipping.Zone, error)
	createZoneFunc            func(ctx context.Context, name string, countriesJSON []byte) (string, error)
	updateZoneFunc            func(ctx context.Context, id, name string, countriesJSON []byte, enabled bool) error
	deleteZoneFunc            func(ctx context.Context, id string) error
	getZoneByCountryFunc      func(ctx context.Context, country string) (*shipping.Zone, error)
	listMethodsFunc           func(ctx context.Context) ([]shipping.Method, error)
	listMethodsByZoneFunc     func(ctx context.Context, zoneID string) ([]shipping.Method, error)
	getMethodFunc             func(ctx context.Context, id string) (*shipping.Method, error)
	createMethodFunc          func(ctx context.Context, method shipping.Method) (string, error)
	updateMethodFunc          func(ctx context.Context, method shipping.Method) error
	deleteMethodFunc          func(ctx context.Context, id string) error
	getCachedTerminalsFunc    func(ctx context.Context, providerKey, country string) ([]byte, time.Time, error)
	upsertCachedTerminalsFunc func(ctx context.Context, providerKey, country string, payloadJSON []byte) error
	deleteCachedTerminalsFunc func(ctx context.Context, providerKey, country string) error
}

func (m *mockStore) ListProviders(ctx context.Context) ([]shipping.Provider, error) {
	if m.listProvidersFunc != nil {
		return m.listProvidersFunc(ctx)
	}
	return []shipping.Provider{}, nil
}

func (m *mockStore) GetProvider(ctx context.Context, key string) (*shipping.Provider, error) {
	if m.getProviderFunc != nil {
		return m.getProviderFunc(ctx, key)
	}
	return nil, nil
}

func (m *mockStore) CreateProvider(ctx context.Context, key, name, mode string, configJSON []byte) error {
	if m.createProviderFunc != nil {
		return m.createProviderFunc(ctx, key, name, mode, configJSON)
	}
	return nil
}

func (m *mockStore) UpdateProvider(ctx context.Context, key string, enabled bool, mode string, configJSON []byte) error {
	if m.updateProviderFunc != nil {
		return m.updateProviderFunc(ctx, key, enabled, mode, configJSON)
	}
	return nil
}

func (m *mockStore) DeleteProvider(ctx context.Context, key string) error {
	if m.deleteProviderFunc != nil {
		return m.deleteProviderFunc(ctx, key)
	}
	return nil
}

func (m *mockStore) ListZones(ctx context.Context) ([]shipping.Zone, error) {
	if m.listZonesFunc != nil {
		return m.listZonesFunc(ctx)
	}
	return []shipping.Zone{}, nil
}

func (m *mockStore) GetZone(ctx context.Context, id string) (*shipping.Zone, error) {
	if m.getZoneFunc != nil {
		return m.getZoneFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockStore) CreateZone(ctx context.Context, name string, countriesJSON []byte) (string, error) {
	if m.createZoneFunc != nil {
		return m.createZoneFunc(ctx, name, countriesJSON)
	}
	return "", nil
}

func (m *mockStore) UpdateZone(ctx context.Context, id, name string, countriesJSON []byte, enabled bool) error {
	if m.updateZoneFunc != nil {
		return m.updateZoneFunc(ctx, id, name, countriesJSON, enabled)
	}
	return nil
}

func (m *mockStore) DeleteZone(ctx context.Context, id string) error {
	if m.deleteZoneFunc != nil {
		return m.deleteZoneFunc(ctx, id)
	}
	return nil
}

func (m *mockStore) GetZoneByCountry(ctx context.Context, country string) (*shipping.Zone, error) {
	if m.getZoneByCountryFunc != nil {
		return m.getZoneByCountryFunc(ctx, country)
	}
	return nil, nil
}

func (m *mockStore) ListMethods(ctx context.Context) ([]shipping.Method, error) {
	if m.listMethodsFunc != nil {
		return m.listMethodsFunc(ctx)
	}
	return []shipping.Method{}, nil
}

func (m *mockStore) ListMethodsByZone(ctx context.Context, zoneID string) ([]shipping.Method, error) {
	if m.listMethodsByZoneFunc != nil {
		return m.listMethodsByZoneFunc(ctx, zoneID)
	}
	return []shipping.Method{}, nil
}

func (m *mockStore) GetMethod(ctx context.Context, id string) (*shipping.Method, error) {
	if m.getMethodFunc != nil {
		return m.getMethodFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockStore) CreateMethod(ctx context.Context, method shipping.Method) (string, error) {
	if m.createMethodFunc != nil {
		return m.createMethodFunc(ctx, method)
	}
	return "", nil
}

func (m *mockStore) UpdateMethod(ctx context.Context, method shipping.Method) error {
	if m.updateMethodFunc != nil {
		return m.updateMethodFunc(ctx, method)
	}
	return nil
}

func (m *mockStore) DeleteMethod(ctx context.Context, id string) error {
	if m.deleteMethodFunc != nil {
		return m.deleteMethodFunc(ctx, id)
	}
	return nil
}

func (m *mockStore) GetCachedTerminals(ctx context.Context, providerKey, country string) ([]byte, time.Time, error) {
	if m.getCachedTerminalsFunc != nil {
		return m.getCachedTerminalsFunc(ctx, providerKey, country)
	}
	return nil, time.Time{}, nil
}

func (m *mockStore) UpsertCachedTerminals(ctx context.Context, providerKey, country string, payloadJSON []byte) error {
	if m.upsertCachedTerminalsFunc != nil {
		return m.upsertCachedTerminalsFunc(ctx, providerKey, country, payloadJSON)
	}
	return nil
}

func (m *mockStore) DeleteCachedTerminals(ctx context.Context, providerKey, country string) error {
	if m.deleteCachedTerminalsFunc != nil {
		return m.deleteCachedTerminalsFunc(ctx, providerKey, country)
	}
	return nil
}

func TestDecodeRequest_InvalidJSON(t *testing.T) {
	r := httptest.NewRequest("POST", "/test", bytes.NewBufferString("invalid json"))

	var req map[string]interface{}
	err := decodeRequest(r, &req)

	if err == nil {
		t.Error("expected error for invalid json")
	}
}

func TestDecodeRequest_EmptyBody(t *testing.T) {
	r := httptest.NewRequest("POST", "/test", bytes.NewBufferString(""))

	var req map[string]interface{}
	err := decodeRequest(r, &req)

	if err == nil {
		t.Error("expected error for empty body")
	}
}

func TestDecodeRequest_Success(t *testing.T) {
	body := `{"name": "Test"}`
	r := httptest.NewRequest("POST", "/test", bytes.NewBufferString(body))

	var req map[string]interface{}
	err := decodeRequest(r, &req)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if req["name"] != "Test" {
		t.Errorf("expected name Test, got %v", req["name"])
	}
}

func TestValidateMethodRequest_AllFieldsValid(t *testing.T) {
	req := upsertMethodRequest{
		ZoneID:      "zone-1",
		ProviderKey: "omniva",
		ServiceCode: "PICKUP_LT",
		Title:       "Test",
		PricingMode: "fixed",
	}

	err := validateMethodRequest(req)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestValidateMethodRequest_MissingZoneID(t *testing.T) {
	req := upsertMethodRequest{
		ProviderKey: "omniva",
		ServiceCode: "PICKUP_LT",
		Title:       "Test",
		PricingMode: "fixed",
	}

	err := validateMethodRequest(req)
	if err == nil {
		t.Error("expected error for missing zone_id")
	}
}

func TestValidateMethodRequest_MissingProviderKey(t *testing.T) {
	req := upsertMethodRequest{
		ZoneID:      "zone-1",
		ServiceCode: "PICKUP_LT",
		Title:       "Test",
		PricingMode: "fixed",
	}

	err := validateMethodRequest(req)
	if err == nil {
		t.Error("expected error for missing provider_key")
	}
}

func TestValidateMethodRequest_MissingServiceCode(t *testing.T) {
	req := upsertMethodRequest{
		ZoneID:      "zone-1",
		ProviderKey: "omniva",
		Title:       "Test",
		PricingMode: "fixed",
	}

	err := validateMethodRequest(req)
	if err == nil {
		t.Error("expected error for missing service_code")
	}
}

func TestValidateMethodRequest_MissingTitle(t *testing.T) {
	req := upsertMethodRequest{
		ZoneID:      "zone-1",
		ProviderKey: "omniva",
		ServiceCode: "PICKUP_LT",
		PricingMode: "fixed",
	}

	err := validateMethodRequest(req)
	if err == nil {
		t.Error("expected error for missing title")
	}
}

func TestValidateMethodRequest_MissingPricingMode(t *testing.T) {
	req := upsertMethodRequest{
		ZoneID:      "zone-1",
		ProviderKey: "omniva",
		ServiceCode: "PICKUP_LT",
		Title:       "Test",
	}

	err := validateMethodRequest(req)
	if err == nil {
		t.Error("expected error for missing pricing_mode")
	}
}

func TestValidateMethodRequest_InvalidPricingMode(t *testing.T) {
	req := upsertMethodRequest{
		ZoneID:      "zone-1",
		ProviderKey: "omniva",
		ServiceCode: "PICKUP_LT",
		Title:       "Test",
		PricingMode: "unknown",
	}

	err := validateMethodRequest(req)
	if err == nil {
		t.Error("expected error for invalid pricing mode")
	}
}

func TestValidatePricingModes(t *testing.T) {
	validModes := []string{"fixed", "table", "provider"}
	for _, mode := range validModes {
		req := upsertMethodRequest{
			ZoneID:      "zone-1",
			ProviderKey: "omniva",
			ServiceCode: "PICKUP_LT",
			Title:       "Test",
			PricingMode: mode,
		}
		err := validateMethodRequest(req)
		if err != nil {
			t.Errorf("pricing mode %s should be valid, got error: %v", mode, err)
		}
	}
}
