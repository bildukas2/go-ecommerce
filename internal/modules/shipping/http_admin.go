package shipping

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	"goecommerce/internal/storage/shipping"
)

type upsertProviderRequest struct {
	Name       string                 `json:"name"`
	Mode       string                 `json:"mode"`
	Enabled    bool                   `json:"enabled"`
	ConfigJSON map[string]interface{} `json:"config_json"`
}

type upsertZoneRequest struct {
	Name      string   `json:"name"`
	Countries []string `json:"countries_json"`
	Enabled   bool     `json:"enabled"`
}

type upsertMethodRequest struct {
	ZoneID           string                 `json:"zone_id"`
	ProviderKey      string                 `json:"provider_key"`
	ServiceCode      string                 `json:"service_code"`
	Title            string                 `json:"title"`
	Enabled          bool                   `json:"enabled"`
	SortOrder        int                    `json:"sort_order"`
	PricingMode      string                 `json:"pricing_mode"`
	PricingRulesJSON map[string]interface{} `json:"pricing_rules_json"`
}

func decodeRequest(r *http.Request, dst any) error {
	defer r.Body.Close()
	const maxBodyBytes = 1 << 20
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		return errors.New("invalid json body")
	}
	if len(body) == 0 {
		return errors.New("request body is required")
	}
	if len(body) > maxBodyBytes {
		return errors.New("request body too large")
	}

	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("request body is required")
		}
		return errors.New("invalid json body")
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return errors.New("invalid json body")
	}
	return nil
}

func (m *module) handleAdminProviders(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	if r.URL.Path == "/admin/shipping/providers" {
		switch r.Method {
		case http.MethodGet:
			m.handleListProviders(w, r)
		default:
			http.NotFound(w, r)
		}
		return
	}

	if strings.HasPrefix(r.URL.Path, "/admin/shipping/providers/") {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/admin/shipping/providers/"), "/")
		if len(parts) > 0 && parts[0] != "" {
			providerKey := parts[0]
			switch r.Method {
			case http.MethodPut:
				m.handleUpdateProvider(w, r, providerKey)
			case http.MethodDelete:
				m.handleDeleteProvider(w, r, providerKey)
			default:
				http.NotFound(w, r)
			}
			return
		}
	}

	http.NotFound(w, r)
}

func (m *module) handleListProviders(w http.ResponseWriter, r *http.Request) {
	providers, err := m.store.ListProviders(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list providers error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"providers": providers})
}

func (m *module) handleUpdateProvider(w http.ResponseWriter, r *http.Request, key string) {
	var req upsertProviderRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Name == "" {
		platformhttp.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.Mode == "" {
		req.Mode = "sandbox"
	}
	if req.Mode != "sandbox" && req.Mode != "live" {
		platformhttp.Error(w, http.StatusBadRequest, "mode must be sandbox or live")
		return
	}

	configJSON, _ := json.Marshal(req.ConfigJSON)

	existing, err := m.store.GetProvider(r.Context(), key)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get provider error")
		return
	}

	if existing == nil {
		if err := m.store.CreateProvider(r.Context(), key, req.Name, req.Mode, configJSON); err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "create provider error")
			return
		}
	} else {
		if err := m.store.UpdateProvider(r.Context(), key, req.Enabled, req.Mode, configJSON); err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "update provider error")
			return
		}
	}

	provider, err := m.store.GetProvider(r.Context(), key)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get provider error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, provider)
}

func (m *module) handleDeleteProvider(w http.ResponseWriter, r *http.Request, key string) {
	if err := m.store.DeleteProvider(r.Context(), key); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "delete provider error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (m *module) handleAdminZones(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	if r.URL.Path == "/admin/shipping/zones" {
		switch r.Method {
		case http.MethodGet:
			m.handleListZones(w, r)
		case http.MethodPost:
			m.handleCreateZone(w, r)
		default:
			http.NotFound(w, r)
		}
		return
	}

	if strings.HasPrefix(r.URL.Path, "/admin/shipping/zones/") {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/admin/shipping/zones/"), "/")
		if len(parts) > 0 && parts[0] != "" {
			zoneID := parts[0]
			switch r.Method {
			case http.MethodPut:
				m.handleUpdateZone(w, r, zoneID)
			case http.MethodDelete:
				m.handleDeleteZone(w, r, zoneID)
			default:
				http.NotFound(w, r)
			}
			return
		}
	}

	http.NotFound(w, r)
}

func (m *module) handleListZones(w http.ResponseWriter, r *http.Request) {
	zones, err := m.store.ListZones(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list zones error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"zones": zones})
}

func (m *module) handleCreateZone(w http.ResponseWriter, r *http.Request) {
	var req upsertZoneRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Name == "" {
		platformhttp.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if len(req.Countries) == 0 {
		platformhttp.Error(w, http.StatusBadRequest, "countries_json is required")
		return
	}

	countriesJSON, _ := json.Marshal(req.Countries)

	id, err := m.store.CreateZone(r.Context(), req.Name, countriesJSON)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "create zone error")
		return
	}

	zone, err := m.store.GetZone(r.Context(), id)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get zone error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusCreated, zone)
}

func (m *module) handleUpdateZone(w http.ResponseWriter, r *http.Request, zoneID string) {
	var req upsertZoneRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Name == "" {
		platformhttp.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if len(req.Countries) == 0 {
		platformhttp.Error(w, http.StatusBadRequest, "countries_json is required")
		return
	}

	countriesJSON, _ := json.Marshal(req.Countries)

	if err := m.store.UpdateZone(r.Context(), zoneID, req.Name, countriesJSON, req.Enabled); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "update zone error")
		return
	}

	zone, err := m.store.GetZone(r.Context(), zoneID)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get zone error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, zone)
}

func (m *module) handleDeleteZone(w http.ResponseWriter, r *http.Request, zoneID string) {
	if err := m.store.DeleteZone(r.Context(), zoneID); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "delete zone error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (m *module) handleAdminMethods(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	if r.URL.Path == "/admin/shipping/methods" {
		switch r.Method {
		case http.MethodGet:
			m.handleListMethods(w, r)
		case http.MethodPost:
			m.handleCreateMethod(w, r)
		default:
			http.NotFound(w, r)
		}
		return
	}

	if strings.HasPrefix(r.URL.Path, "/admin/shipping/methods/") {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/admin/shipping/methods/"), "/")
		if len(parts) > 0 && parts[0] != "" {
			methodID := parts[0]
			switch r.Method {
			case http.MethodPut:
				m.handleUpdateMethod(w, r, methodID)
			case http.MethodDelete:
				m.handleDeleteMethod(w, r, methodID)
			default:
				http.NotFound(w, r)
			}
			return
		}
	}

	http.NotFound(w, r)
}

func (m *module) handleListMethods(w http.ResponseWriter, r *http.Request) {
	methods, err := m.store.ListMethods(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list methods error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"methods": methods})
}

func (m *module) handleCreateMethod(w http.ResponseWriter, r *http.Request) {
	var req upsertMethodRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := validateMethodRequest(req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	pricingRulesJSON, _ := json.Marshal(req.PricingRulesJSON)

	method := shipping.Method{
		ZoneID:           req.ZoneID,
		ProviderKey:      req.ProviderKey,
		ServiceCode:      req.ServiceCode,
		Title:            req.Title,
		Enabled:          req.Enabled,
		SortOrder:        req.SortOrder,
		PricingMode:      req.PricingMode,
		PricingRulesJSON: pricingRulesJSON,
	}

	id, err := m.store.CreateMethod(r.Context(), method)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "create method error")
		return
	}

	created, err := m.store.GetMethod(r.Context(), id)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get method error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusCreated, created)
}

func (m *module) handleUpdateMethod(w http.ResponseWriter, r *http.Request, methodID string) {
	var req upsertMethodRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := validateMethodRequest(req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	pricingRulesJSON, _ := json.Marshal(req.PricingRulesJSON)

	method := shipping.Method{
		ID:               methodID,
		ZoneID:           req.ZoneID,
		ProviderKey:      req.ProviderKey,
		ServiceCode:      req.ServiceCode,
		Title:            req.Title,
		Enabled:          req.Enabled,
		SortOrder:        req.SortOrder,
		PricingMode:      req.PricingMode,
		PricingRulesJSON: pricingRulesJSON,
	}

	if err := m.store.UpdateMethod(r.Context(), method); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "update method error")
		return
	}

	updated, err := m.store.GetMethod(r.Context(), methodID)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get method error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, updated)
}

func (m *module) handleDeleteMethod(w http.ResponseWriter, r *http.Request, methodID string) {
	if err := m.store.DeleteMethod(r.Context(), methodID); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "delete method error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (m *module) handleAdminTerminals(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		m.handleGetTerminals(w, r)
	case http.MethodPost:
		m.handleRefreshTerminals(w, r)
	case http.MethodDelete:
		m.handleDeleteTerminals(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleGetTerminals(w http.ResponseWriter, r *http.Request) {
	provider := strings.TrimSpace(r.URL.Query().Get("provider"))
	country := strings.TrimSpace(r.URL.Query().Get("country"))

	if provider == "" || country == "" {
		platformhttp.Error(w, http.StatusBadRequest, "provider and country parameters are required")
		return
	}

	payload, fetchedAt, err := m.store.GetCachedTerminals(r.Context(), provider, country)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get terminals error")
		return
	}

	if payload == nil {
		payload = []byte("[]")
	}

	var terminals []any
	_ = json.Unmarshal(payload, &terminals)

	response := map[string]any{
		"provider":   provider,
		"country":    country,
		"terminals":  terminals,
		"fetched_at": fetchedAt,
	}

	_ = platformhttp.JSON(w, http.StatusOK, response)
}

func (m *module) handleRefreshTerminals(w http.ResponseWriter, r *http.Request) {
	provider := strings.TrimSpace(r.URL.Query().Get("provider"))
	country := strings.TrimSpace(r.URL.Query().Get("country"))

	if provider == "" || country == "" {
		platformhttp.Error(w, http.StatusBadRequest, "provider and country parameters are required")
		return
	}

	prov, ok := m.providers[provider]
	if !ok {
		platformhttp.Error(w, http.StatusBadRequest, "provider not found or not enabled")
		return
	}

	terminals, err := prov.ListTerminals(r.Context(), country)
	if err != nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "provider error: "+err.Error())
		return
	}

	payload, _ := json.Marshal(terminals)
	if err := m.store.UpsertCachedTerminals(r.Context(), provider, country, payload); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "cache terminals error")
		return
	}

	response := map[string]any{
		"status":    "refreshed",
		"provider":  provider,
		"country":   country,
		"terminals": terminals,
	}

	_ = platformhttp.JSON(w, http.StatusOK, response)
}

func (m *module) handleDeleteTerminals(w http.ResponseWriter, r *http.Request) {
	provider := strings.TrimSpace(r.URL.Query().Get("provider"))
	country := strings.TrimSpace(r.URL.Query().Get("country"))

	if provider == "" || country == "" {
		platformhttp.Error(w, http.StatusBadRequest, "provider and country parameters are required")
		return
	}

	if err := m.store.DeleteCachedTerminals(r.Context(), provider, country); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "delete terminals error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func validateMethodRequest(req upsertMethodRequest) error {
	if req.ZoneID == "" {
		return errors.New("zone_id is required")
	}
	if req.ProviderKey == "" {
		return errors.New("provider_key is required")
	}
	if req.ServiceCode == "" {
		return errors.New("service_code is required")
	}
	if req.Title == "" {
		return errors.New("title is required")
	}
	if req.PricingMode == "" {
		return errors.New("pricing_mode is required")
	}
	if req.PricingMode != "fixed" && req.PricingMode != "table" && req.PricingMode != "provider" {
		return errors.New("pricing_mode must be fixed, table, or provider")
	}
	return nil
}
