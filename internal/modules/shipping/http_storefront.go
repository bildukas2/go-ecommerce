package shipping

import (
	"database/sql"
	"encoding/json"
	"log"
	"math"
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

	cartWeightStr := strings.TrimSpace(r.URL.Query().Get("cart_weight_kg"))
	var cartWeightKg float64
	hasCartWeight := false
	if cartWeightStr != "" {
		val, err := strconv.ParseFloat(cartWeightStr, 64)
		if err != nil || val < 0 {
			platformhttp.Error(w, http.StatusBadRequest, "invalid cart_weight_kg")
			return
		}
		cartWeightKg = val
		hasCartWeight = true
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

		price := calculateMethodPrice(&method, cartValue, cartWeightKg, hasCartWeight)
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

func calculateMethodPrice(method *storshiping.Method, cartValue int64, cartWeightKg float64, hasCartWeight bool) int {
	if method.PricingMode == "" {
		method.PricingMode = "flat"
	}

	var rules map[string]any
	if len(method.PricingRulesJSON) > 0 {
		if err := json.Unmarshal(method.PricingRulesJSON, &rules); err != nil {
			log.Printf("error unmarshaling pricing rules for method %s: %v", method.ID, err)
			rules = make(map[string]any)
		}
	}

	resolveTiers := func(primaryKey, legacyKey string) []any {
		if v, ok := rules[primaryKey].([]any); ok {
			return v
		}
		if v, ok := rules[legacyKey].([]any); ok {
			return v
		}
		return nil
	}

	matchesTier := func(value, min, max float64, hasMax bool) bool {
		if value < min {
			return false
		}
		if hasMax && value >= max {
			return false
		}
		return true
	}

	lookupInt := func(obj map[string]any, keys ...string) (int64, bool) {
		for _, key := range keys {
			v, ok := obj[key]
			if !ok {
				continue
			}
			n, ok := v.(float64)
			if !ok || n < 0 || math.Trunc(n) != n {
				continue
			}
			return int64(n), true
		}
		return 0, false
	}

	lookupNumber := func(obj map[string]any, keys ...string) (float64, bool) {
		for _, key := range keys {
			v, ok := obj[key]
			if !ok {
				continue
			}
			n, ok := v.(float64)
			if !ok || n < 0 {
				continue
			}
			return n, true
		}
		return 0, false
	}

	applyProviderAdjustments := func(basePrice int64) int {
		price := float64(basePrice)
		if markupFixed, ok := lookupInt(rules, "markupFixed"); ok {
			price += float64(markupFixed)
		}
		if markupPercent, ok := lookupNumber(rules, "markupPercent"); ok {
			price += (float64(basePrice) * markupPercent / 100.0)
		}
		finalPrice := int64(math.Round(price))
		if minPrice, ok := lookupInt(rules, "minPrice"); ok && finalPrice < minPrice {
			finalPrice = minPrice
		}
		if maxPrice, ok := lookupInt(rules, "maxPrice"); ok && finalPrice > maxPrice {
			finalPrice = maxPrice
		}
		if finalPrice < 0 {
			return 0
		}
		return int(finalPrice)
	}

	getFlatPrice := func() int {
		freeOver, hasFreeOver := lookupInt(rules, "freeOver", "free_shipping_order_min_cents")
		if hasFreeOver && cartValue >= freeOver {
			return 0
		}
		if price, ok := lookupInt(rules, "price", "base_price_cents"); ok {
			return int(price)
		}
		return 0
	}

	mode := method.PricingMode
	switch mode {
	case "fixed":
		mode = "flat"
	case "table":
		mode = "weight_tiers"
	}

	switch mode {
	case "flat":
		return getFlatPrice()

	case "free":
		if always, ok := rules["always"].(bool); ok && always {
			return 0
		}
		freeOver, ok := lookupInt(rules, "freeOver")
		if ok && cartValue >= freeOver {
			return 0
		}
		return 0

	case "total_tiers":
		tiers := resolveTiers("tiers", "")
		for _, rawTier := range tiers {
			tier, ok := rawTier.(map[string]any)
			if !ok {
				continue
			}
			min, hasMin := lookupNumber(tier, "min")
			if !hasMin {
				continue
			}
			max, hasMax := lookupNumber(tier, "max")
			price, hasPrice := lookupInt(tier, "price")
			if !hasPrice {
				continue
			}
			if matchesTier(float64(cartValue), min, max, hasMax) {
				return int(price)
			}
		}
		return 0

	case "weight_tiers":
		tiers := resolveTiers("tiers", "rules")
		effectiveWeight := cartWeightKg
		if !hasCartWeight {
			effectiveWeight = 0
		}

		for _, rawTier := range tiers {
			tier, ok := rawTier.(map[string]any)
			if !ok {
				continue
			}
			min, hasMin := lookupNumber(tier, "min", "min_weight_kg")
			if !hasMin {
				continue
			}
			max, hasMax := lookupNumber(tier, "max", "max_weight_kg")
			price, hasPrice := lookupInt(tier, "price", "price_cents")
			if !hasPrice {
				continue
			}
			if matchesTier(effectiveWeight, min, max, hasMax) {
				return int(price)
			}
		}
		return 0

	case "provider":
		return applyProviderAdjustments(0)

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
