package shipping

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	shipping "goecommerce/internal/platform/shipping"
	storshiping "goecommerce/internal/storage/shipping"
)

type shippingOptionsResponse struct {
	Zone    *zoneDTO    `json:"zone"`
	Methods []methodDTO `json:"methods"`
}

type zoneDTO struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Countries []string `json:"countries"`
	Enabled   bool     `json:"enabled"`
}

type methodDTO struct {
	ID          string `json:"id"`
	ZoneID      string `json:"zone_id"`
	ProviderKey string `json:"provider_key"`
	ServiceCode string `json:"service_code"`
	Title       string `json:"title"`
	Enabled     bool   `json:"enabled"`
	SortOrder   int    `json:"sort_order"`
	PricingMode string `json:"pricing_mode"`
	Price       int    `json:"price"`
	Currency    string `json:"currency"`
}

type terminalsResponse struct {
	Provider  string              `json:"provider"`
	Country   string              `json:"country"`
	Terminals []shipping.Terminal `json:"terminals"`
}

func (m *module) handleStorefrontShippingOptions(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	country := strings.TrimSpace(r.URL.Query().Get("country"))
	if country == "" {
		platformhttp.Error(w, http.StatusBadRequest, "country is required")
		return
	}

	cartValueStr := strings.TrimSpace(r.URL.Query().Get("cart_value"))
	var cartValue int64
	if cartValueStr != "" {
		val, err := strconv.ParseInt(cartValueStr, 10, 64)
		if err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid cart_value")
			return
		}
		cartValue = val
	}

	zone, err := m.store.GetZoneByCountry(r.Context(), country)
	if err != nil {
		if err == sql.ErrNoRows {
			_ = platformhttp.JSON(w, http.StatusOK, shippingOptionsResponse{
				Zone:    nil,
				Methods: []methodDTO{},
			})
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "error fetching zone")
		return
	}

	methods, err := m.store.ListMethodsByZone(r.Context(), zone.ID)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "error fetching methods")
		return
	}

	var countries []string
	if err := json.Unmarshal(zone.CountriesJSON, &countries); err != nil {
		countries = []string{}
	}

	zoneDTO := &zoneDTO{
		ID:        zone.ID,
		Name:      zone.Name,
		Countries: countries,
		Enabled:   zone.Enabled,
	}

	var methodDTOs []methodDTO
	for _, method := range methods {
		if !method.Enabled {
			continue
		}

		price := calculateMethodPrice(&method, cartValue)
		methodDTOs = append(methodDTOs, methodDTO{
			ID:          method.ID,
			ZoneID:      method.ZoneID,
			ProviderKey: method.ProviderKey,
			ServiceCode: method.ServiceCode,
			Title:       method.Title,
			Enabled:     method.Enabled,
			SortOrder:   method.SortOrder,
			PricingMode: method.PricingMode,
			Price:       price,
			Currency:    "EUR",
		})
	}

	_ = platformhttp.JSON(w, http.StatusOK, shippingOptionsResponse{
		Zone:    zoneDTO,
		Methods: methodDTOs,
	})
}

func calculateMethodPrice(method *storshiping.Method, cartValue int64) int {
	if method.PricingMode == "" {
		method.PricingMode = "fixed"
	}

	var rules map[string]any
	if len(method.PricingRulesJSON) > 0 {
		if err := json.Unmarshal(method.PricingRulesJSON, &rules); err != nil {
			log.Printf("error unmarshaling pricing rules for method %s: %v", method.ID, err)
			rules = make(map[string]any)
		}
	}

	checkFreeShipping := func() int {
		if freeThreshold, ok := rules["free_shipping_order_min_cents"]; ok {
			if threshold, ok := freeThreshold.(float64); ok && cartValue > 0 && cartValue >= int64(threshold) {
				return 0
			}
		}
		return -1
	}

	switch method.PricingMode {
	case "fixed":
		if freePrice := checkFreeShipping(); freePrice == 0 {
			return 0
		}
		if basePrice, ok := rules["base_price_cents"]; ok {
			if price, ok := basePrice.(float64); ok {
				return int(price)
			}
		}
		return 0

	case "table":
		if freePrice := checkFreeShipping(); freePrice == 0 {
			return 0
		}
		if tableRules, ok := rules["rules"]; ok {
			if rulesArray, ok := tableRules.([]any); ok {
				for _, rule := range rulesArray {
					if ruleMap, ok := rule.(map[string]any); ok {
						priceCents, ok := ruleMap["price_cents"].(float64)
						if !ok {
							continue
						}
						price := int(priceCents)
						return price
					}
				}
			}
		}
		return 0

	default:
		return 0
	}
}

func (m *module) handleStorefrontTerminals(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	provider := strings.TrimSpace(r.URL.Query().Get("provider"))
	country := strings.TrimSpace(r.URL.Query().Get("country"))

	if provider == "" {
		platformhttp.Error(w, http.StatusBadRequest, "provider is required")
		return
	}
	if country == "" {
		platformhttp.Error(w, http.StatusBadRequest, "country is required")
		return
	}

	cached, _, err := m.store.GetCachedTerminals(r.Context(), provider, country)
	if err == nil && len(cached) > 0 {
		var terminals []shipping.Terminal
		if err := json.Unmarshal(cached, &terminals); err == nil {
			_ = platformhttp.JSON(w, http.StatusOK, terminalsResponse{
				Provider:  provider,
				Country:   country,
				Terminals: terminals,
			})
			return
		}
	}

	prov, ok := m.providers[provider]
	if !ok {
		platformhttp.Error(w, http.StatusBadRequest, "provider not found or not enabled")
		return
	}

	terminals, err := prov.ListTerminals(r.Context(), country)
	if err != nil {
		log.Printf("error fetching terminals from provider %s: %v", provider, err)
		platformhttp.Error(w, http.StatusServiceUnavailable, "error fetching terminals from provider")
		return
	}

	terminalsJSON, err := json.Marshal(terminals)
	if err != nil {
		log.Printf("error marshaling terminals: %v", err)
		platformhttp.Error(w, http.StatusInternalServerError, "error processing terminals")
		return
	}

	if err := m.store.UpsertCachedTerminals(r.Context(), provider, country, terminalsJSON); err != nil {
		log.Printf("error caching terminals: %v", err)
	}

	_ = platformhttp.JSON(w, http.StatusOK, terminalsResponse{
		Provider:  provider,
		Country:   country,
		Terminals: terminals,
	})
}
