package shipping

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	platformshipping "goecommerce/internal/platform/shipping"
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

type providerResponse struct {
	ID         string                 `json:"id"`
	Key        string                 `json:"key"`
	Name       string                 `json:"name"`
	Enabled    bool                   `json:"enabled"`
	Mode       string                 `json:"mode"`
	ConfigJSON map[string]interface{} `json:"config_json"`
	CreatedAt  any                    `json:"created_at"`
	UpdatedAt  any                    `json:"updated_at"`
}

type providerPluginResponse struct {
	Key  string `json:"key"`
	Name string `json:"name"`
}

type zoneResponse struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Countries []string `json:"countries_json"`
	Enabled   bool     `json:"enabled"`
	CreatedAt any      `json:"created_at"`
	UpdatedAt any      `json:"updated_at"`
}

type methodResponse struct {
	ID               string                 `json:"id"`
	ZoneID           string                 `json:"zone_id"`
	ProviderKey      string                 `json:"provider_key"`
	ServiceCode      string                 `json:"service_code"`
	Title            string                 `json:"title"`
	Enabled          bool                   `json:"enabled"`
	SortOrder        int                    `json:"sort_order"`
	PricingMode      string                 `json:"pricing_mode"`
	PricingRulesJSON map[string]interface{} `json:"pricing_rules_json"`
	CreatedAt        any                    `json:"created_at"`
	UpdatedAt        any                    `json:"updated_at"`
}

func toProviderResponse(provider shipping.Provider) providerResponse {
	config := map[string]interface{}{}
	if len(provider.ConfigJSON) > 0 {
		_ = json.Unmarshal(provider.ConfigJSON, &config)
	}
	if config == nil {
		config = map[string]interface{}{}
	}
	return providerResponse{
		ID:         provider.ID,
		Key:        provider.Key,
		Name:       provider.Name,
		Enabled:    provider.Enabled,
		Mode:       provider.Mode,
		ConfigJSON: config,
		CreatedAt:  provider.CreatedAt,
		UpdatedAt:  provider.UpdatedAt,
	}
}

func toZoneResponse(zone shipping.Zone) zoneResponse {
	countries := []string{}
	if len(zone.CountriesJSON) > 0 {
		_ = json.Unmarshal(zone.CountriesJSON, &countries)
	}
	if countries == nil {
		countries = []string{}
	}
	return zoneResponse{
		ID:        zone.ID,
		Name:      zone.Name,
		Countries: countries,
		Enabled:   zone.Enabled,
		CreatedAt: zone.CreatedAt,
		UpdatedAt: zone.UpdatedAt,
	}
}

func toMethodResponse(method shipping.Method) methodResponse {
	pricingRules := map[string]interface{}{}
	if len(method.PricingRulesJSON) > 0 {
		_ = json.Unmarshal(method.PricingRulesJSON, &pricingRules)
	}
	if pricingRules == nil {
		pricingRules = map[string]interface{}{}
	}
	return methodResponse{
		ID:               method.ID,
		ZoneID:           method.ZoneID,
		ProviderKey:      method.ProviderKey,
		ServiceCode:      method.ServiceCode,
		Title:            method.Title,
		Enabled:          method.Enabled,
		SortOrder:        method.SortOrder,
		PricingMode:      method.PricingMode,
		PricingRulesJSON: pricingRules,
		CreatedAt:        method.CreatedAt,
		UpdatedAt:        method.UpdatedAt,
	}
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
	if r.URL.Path == "/admin/shipping/providers/plugins" {
		if r.Method == http.MethodGet {
			m.handleListProviderPlugins(w, r)
			return
		}
		http.NotFound(w, r)
		return
	}

	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	if r.URL.Path == "/admin/shipping/providers" {
		switch r.Method {
		case http.MethodGet:
			m.handleListProviders(w, r)
		case http.MethodPost:
			m.handleCreateProvider(w, r)
		default:
			http.NotFound(w, r)
		}
		return
	}

	if strings.HasPrefix(r.URL.Path, "/admin/shipping/providers/") {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/admin/shipping/providers/"), "/")
		if len(parts) > 0 && parts[0] != "" {
			providerKey := parts[0]
			// Check for sub-actions like /test
			if len(parts) > 1 && parts[1] == "test" {
				if r.Method == http.MethodPost {
					m.handleTestProvider(w, r, providerKey)
					return
				}
				http.NotFound(w, r)
				return
			}
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

func (m *module) handleCreateProvider(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Key        string                 `json:"key"`
		Name       string                 `json:"name"`
		Mode       string                 `json:"mode"`
		Enabled    bool                   `json:"enabled"`
		ConfigJSON map[string]interface{} `json:"config_json"`
	}
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Key == "" {
		platformhttp.Error(w, http.StatusBadRequest, "key is required")
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

	// Check if provider already exists
	existing, err := m.store.GetProvider(r.Context(), req.Key)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		platformhttp.Error(w, http.StatusInternalServerError, "get provider error")
		return
	}
	if existing != nil {
		platformhttp.Error(w, http.StatusConflict, "provider with this key already exists")
		return
	}

	configJSON, _ := json.Marshal(req.ConfigJSON)

	if err := m.store.CreateProvider(r.Context(), req.Key, req.Name, req.Mode, configJSON); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "create provider error")
		return
	}

	provider, err := m.store.GetProvider(r.Context(), req.Key)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get provider error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusCreated, toProviderResponse(*provider))
}

func (m *module) handleTestProvider(w http.ResponseWriter, r *http.Request, key string) {
	// Parse request body for config override (allows testing before saving)
	var req struct {
		ConfigJSON map[string]any `json:"config_json"`
		Mode       string         `json:"mode"`
	}
	if err := decodeRequest(r, &req); err != nil {
		// Body is optional, continue with DB config
	}

	// Get factory for this provider
	factory, err := platformshipping.Get(key)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "provider not registered: "+key)
		return
	}

	// Use config from request if provided, otherwise fall back to DB
	var config map[string]any
	if len(req.ConfigJSON) > 0 {
		config = req.ConfigJSON
	} else {
		// Get provider from DB
		dbProvider, err := m.store.GetProvider(r.Context(), key)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				platformhttp.Error(w, http.StatusNotFound, "provider not found and no config provided")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "get provider error")
			return
		}
		if len(dbProvider.ConfigJSON) > 0 {
			if err := json.Unmarshal(dbProvider.ConfigJSON, &config); err != nil {
				platformhttp.Error(w, http.StatusInternalServerError, "parse config error")
				return
			}
		}
	}

	if config == nil {
		config = make(map[string]any)
	}

	// Add mode to config if provided
	if req.Mode != "" {
		config["mode"] = req.Mode
	}

	// Create provider instance
	prov, err := factory(config)
	if err != nil {
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
			"message": "Failed to create provider instance",
		})
		return
	}

	// Test connection by listing terminals for a default country
	testCountry := "LT"
	terminals, err := prov.ListTerminals(r.Context(), testCountry)
	if err != nil {
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
			"message": "Connection test failed",
		})
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"message":         "Connection successful",
		"terminals_found": len(terminals),
		"provider":        prov.Key(),
		"name":            prov.Name(),
		"capabilities":    prov.Capabilities(),
	})
}

func (m *module) handleListProviders(w http.ResponseWriter, r *http.Request) {
	providers, err := m.store.ListProviders(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list providers error")
		return
	}
	items := make([]providerResponse, 0, len(providers))
	for _, provider := range providers {
		items = append(items, toProviderResponse(provider))
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (m *module) handleListProviderPlugins(w http.ResponseWriter, r *http.Request) {
	keys := platformshipping.ListKeys()
	items := make([]providerPluginResponse, 0, len(keys))

	for _, key := range keys {
		name := pluginLabelFromKey(key)

		factory, err := platformshipping.Get(key)
		if err == nil {
			provider, err := factory(map[string]any{})
			if err == nil {
				resolvedName := strings.TrimSpace(provider.Name())
				if resolvedName != "" {
					name = resolvedName
				}
			}
		}

		items = append(items, providerPluginResponse{
			Key:  key,
			Name: name,
		})
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func pluginLabelFromKey(key string) string {
	parts := strings.FieldsFunc(key, func(r rune) bool {
		return r == '_' || r == '-' || r == ' '
	})
	if len(parts) == 0 {
		return key
	}

	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
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
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
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

	_ = platformhttp.JSON(w, http.StatusOK, toProviderResponse(*provider))
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
	items := make([]zoneResponse, 0, len(zones))
	for _, zone := range zones {
		items = append(items, toZoneResponse(zone))
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
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

	_ = platformhttp.JSON(w, http.StatusCreated, toZoneResponse(*zone))
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

	_ = platformhttp.JSON(w, http.StatusOK, toZoneResponse(*zone))
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
	responses := make([]methodResponse, len(methods))
	for i, method := range methods {
		responses[i] = toMethodResponse(method)
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"methods": responses})
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

	_ = platformhttp.JSON(w, http.StatusCreated, toMethodResponse(*created))
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

	_ = platformhttp.JSON(w, http.StatusOK, toMethodResponse(*updated))
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
	switch req.PricingMode {
	case "flat":
		if err := validateFlatPricingRules(req.PricingRulesJSON); err != nil {
			return err
		}
	case "free":
		if err := validateFreePricingRules(req.PricingRulesJSON); err != nil {
			return err
		}
	case "total_tiers":
		if err := validateTotalTiersPricingRules(req.PricingRulesJSON); err != nil {
			return err
		}
	case "weight_tiers":
		if err := validateWeightTiersPricingRules(req.PricingRulesJSON); err != nil {
			return err
		}
	case "provider":
		if err := validateProviderPricingRules(req.PricingRulesJSON); err != nil {
			return err
		}
	default:
		return errors.New("pricing_mode must be flat, free, total_tiers, weight_tiers, or provider")
	}
	return nil
}

func validateFlatPricingRules(rules map[string]interface{}) error {
	if rules == nil {
		return errors.New("pricing_rules_json.price is required for flat mode")
	}
	if _, _, err := getIntField(rules, "price", true); err != nil {
		return fmt.Errorf("pricing_rules_json.%w", err)
	}
	if _, _, err := getIntField(rules, "freeOver", false); err != nil {
		return fmt.Errorf("pricing_rules_json.%w", err)
	}
	return nil
}

func validateFreePricingRules(rules map[string]interface{}) error {
	if rules == nil {
		return errors.New("pricing_rules_json.always or pricing_rules_json.freeOver is required for free mode")
	}
	always, hasAlways, err := getBoolField(rules, "always")
	if err != nil {
		return fmt.Errorf("pricing_rules_json.%w", err)
	}
	_, hasFreeOver, err := getIntField(rules, "freeOver", false)
	if err != nil {
		return fmt.Errorf("pricing_rules_json.%w", err)
	}
	if hasAlways && hasFreeOver {
		return errors.New("pricing_rules_json.always and pricing_rules_json.freeOver cannot be used together for free mode")
	}
	if hasAlways {
		if !always {
			return errors.New("pricing_rules_json.always must be true when set for free mode")
		}
		return nil
	}
	if hasFreeOver {
		return nil
	}
	return errors.New("pricing_rules_json.always or pricing_rules_json.freeOver is required for free mode")
}

func validateTotalTiersPricingRules(rules map[string]interface{}) error {
	if rules == nil {
		return errors.New("pricing_rules_json.tiers is required for total_tiers mode")
	}
	if err := validatePriceTiers(rules, true); err != nil {
		return err
	}
	return nil
}

func validateWeightTiersPricingRules(rules map[string]interface{}) error {
	if rules == nil {
		return errors.New("pricing_rules_json.tiers is required for weight_tiers mode")
	}
	if rawUnit, ok := rules["unit"]; ok {
		unit, ok := rawUnit.(string)
		if !ok {
			return errors.New("pricing_rules_json.unit must be a string")
		}
		if unit != "kg" {
			return errors.New("pricing_rules_json.unit must be kg")
		}
	}
	if err := validatePriceTiers(rules, false); err != nil {
		return err
	}
	return nil
}

func validateProviderPricingRules(rules map[string]interface{}) error {
	if rules == nil {
		return nil
	}
	if _, _, err := getBoolField(rules, "liveRates"); err != nil {
		return fmt.Errorf("pricing_rules_json.%w", err)
	}
	minPrice, hasMinPrice, err := getIntField(rules, "minPrice", false)
	if err != nil {
		return fmt.Errorf("pricing_rules_json.%w", err)
	}
	maxPrice, hasMaxPrice, err := getIntField(rules, "maxPrice", false)
	if err != nil {
		return fmt.Errorf("pricing_rules_json.%w", err)
	}
	if hasMinPrice && hasMaxPrice && maxPrice < minPrice {
		return errors.New("pricing_rules_json.maxPrice must be greater than or equal to pricing_rules_json.minPrice")
	}
	if _, _, err := getIntField(rules, "markupFixed", false); err != nil {
		return fmt.Errorf("pricing_rules_json.%w", err)
	}
	if _, _, err := getNumberField(rules, "markupPercent"); err != nil {
		return fmt.Errorf("pricing_rules_json.%w", err)
	}
	return nil
}

func validatePriceTiers(rules map[string]interface{}, integerBounds bool) error {
	rawTiers, ok := rules["tiers"]
	if !ok {
		return errors.New("pricing_rules_json.tiers is required")
	}
	tiers, ok := rawTiers.([]interface{})
	if !ok {
		return errors.New("pricing_rules_json.tiers must be an array")
	}
	if len(tiers) == 0 {
		return errors.New("pricing_rules_json.tiers must contain at least one tier")
	}
	for i, rawTier := range tiers {
		tier, ok := rawTier.(map[string]interface{})
		if !ok {
			return fmt.Errorf("pricing_rules_json.tiers[%d] must be an object", i)
		}
		min, hasMin, err := getNumberField(tier, "min")
		if err != nil || !hasMin {
			if err != nil {
				return fmt.Errorf("pricing_rules_json.tiers[%d].%s", i, err.Error())
			}
			return fmt.Errorf("pricing_rules_json.tiers[%d].min is required", i)
		}
		if min < 0 {
			return fmt.Errorf("pricing_rules_json.tiers[%d].min must be non-negative", i)
		}
		if integerBounds && math.Trunc(min) != min {
			return fmt.Errorf("pricing_rules_json.tiers[%d].min must be a whole number", i)
		}
		max, hasMax, err := getNumberField(tier, "max")
		if err != nil {
			return fmt.Errorf("pricing_rules_json.tiers[%d].%s", i, err.Error())
		}
		if hasMax {
			if max < 0 {
				return fmt.Errorf("pricing_rules_json.tiers[%d].max must be non-negative", i)
			}
			if integerBounds && math.Trunc(max) != max {
				return fmt.Errorf("pricing_rules_json.tiers[%d].max must be a whole number", i)
			}
			if max < min {
				return fmt.Errorf("pricing_rules_json.tiers[%d].max must be greater than or equal to min", i)
			}
		}
		if _, _, err := getIntField(tier, "price", true); err != nil {
			return fmt.Errorf("pricing_rules_json.tiers[%d].%s", i, err.Error())
		}
	}
	return nil
}

func getIntField(obj map[string]interface{}, key string, required bool) (int64, bool, error) {
	v, ok := obj[key]
	if !ok {
		if required {
			return 0, false, fmt.Errorf("%s is required", key)
		}
		return 0, false, nil
	}
	n, ok := v.(float64)
	if !ok {
		return 0, true, fmt.Errorf("%s must be a number", key)
	}
	if n < 0 {
		return 0, true, fmt.Errorf("%s must be non-negative", key)
	}
	if math.Trunc(n) != n {
		return 0, true, fmt.Errorf("%s must be a whole number", key)
	}
	return int64(n), true, nil
}

func getBoolField(obj map[string]interface{}, key string) (bool, bool, error) {
	v, ok := obj[key]
	if !ok {
		return false, false, nil
	}
	b, ok := v.(bool)
	if !ok {
		return false, true, fmt.Errorf("%s must be a boolean", key)
	}
	return b, true, nil
}

func getNumberField(obj map[string]interface{}, key string) (float64, bool, error) {
	v, ok := obj[key]
	if !ok {
		return 0, false, nil
	}
	n, ok := v.(float64)
	if !ok {
		return 0, true, fmt.Errorf("%s must be a number", key)
	}
	if n < 0 {
		return 0, true, fmt.Errorf("%s must be non-negative", key)
	}
	return n, true, nil
}
