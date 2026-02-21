package omniva

import (
	"context"
	"fmt"

	"goecommerce/internal/platform/shipping"
)

type omnivaProvider struct {
	username string
	password string
	baseURL  string
	mode     string
}

func NewProvider(config map[string]any) (shipping.Provider, error) {
	username, ok := config["username"].(string)
	if !ok {
		username = ""
	}
	password, ok := config["password"].(string)
	if !ok {
		password = ""
	}
	baseURL, ok := config["base_url"].(string)
	if !ok {
		baseURL = "https://sandbox.omniva.lt/api"
	}
	mode, ok := config["mode"].(string)
	if !ok {
		mode = "sandbox"
	}

	prov := &omnivaProvider{
		username: username,
		password: password,
		baseURL:  baseURL,
		mode:     mode,
	}

	return prov, nil
}

func init() {
	shipping.Register("omniva", NewProvider)
}

func (p *omnivaProvider) ListTerminals(ctx context.Context, country string) ([]shipping.Terminal, error) {
	switch country {
	case "LT":
		return mockTerminalsLT(), nil
	case "LV":
		return mockTerminalsLV(), nil
	case "EE":
		return mockTerminalsEE(), nil
	default:
		return nil, fmt.Errorf("unsupported country: %s", country)
	}
}

func (p *omnivaProvider) Quote(ctx context.Context, req shipping.QuoteRequest) ([]shipping.ShippingOption, error) {
	if req.Country == "" {
		return nil, fmt.Errorf("country is required for quote")
	}

	options := p.priceForCountry(req.Country, req.Weight)
	return options, nil
}

func (p *omnivaProvider) priceForCountry(country string, weight float64) []shipping.ShippingOption {
	basePrice := 500
	switch country {
	case "LT":
		basePrice = 500
	case "LV":
		basePrice = 600
	case "EE":
		basePrice = 600
	default:
		basePrice = 1000
	}

	weightFee := int(weight * 50)

	return []shipping.ShippingOption{
		{
			ServiceCode: "parcel-locker",
			ServiceName: "Parcel Locker",
			Price:       basePrice + weightFee,
			Currency:    "EUR",
			Estimate:    "1-2 business days",
			MetaJSON: map[string]any{
				"service_type": "parcel_locker",
			},
		},
		{
			ServiceCode: "home-delivery",
			ServiceName: "Home Delivery",
			Price:       basePrice + weightFee + 300,
			Currency:    "EUR",
			Estimate:    "2-3 business days",
			MetaJSON: map[string]any{
				"service_type": "home_delivery",
			},
		},
		{
			ServiceCode: "express",
			ServiceName: "Express Delivery",
			Price:       basePrice + weightFee + 800,
			Currency:    "EUR",
			Estimate:    "Next business day",
			MetaJSON: map[string]any{
				"service_type": "express",
			},
		},
	}
}

func mockTerminalsLT() []shipping.Terminal {
	return []shipping.Terminal{
		{
			ID:      "omniva_lt_001",
			Name:    "Vilnius Central",
			Country: "LT",
			City:    "Vilnius",
			Address: "Gedimino ave. 9, 01103 Vilnius",
			Lat:     54.6872,
			Lon:     25.2797,
			Hours:   "08:00-20:00",
		},
		{
			ID:      "omniva_lt_002",
			Name:    "Vilnius Airport",
			Country: "LT",
			City:    "Vilnius",
			Address: "Rodūnios kelias 2, 02100 Vilnius",
			Lat:     54.6325,
			Lon:     25.2865,
			Hours:   "07:00-21:00",
		},
		{
			ID:      "omniva_lt_003",
			Name:    "Kaunas City",
			Country: "LT",
			City:    "Kaunas",
			Address: "Savanorių ave. 246, 50131 Kaunas",
			Lat:     54.8973,
			Lon:     24.0905,
			Hours:   "08:00-19:00",
		},
		{
			ID:      "omniva_lt_004",
			Name:    "Klaipėda Port",
			Country: "LT",
			City:    "Klaipėda",
			Address: "Jūrų str. 15, 92100 Klaipėda",
			Lat:     55.7203,
			Lon:     21.1449,
			Hours:   "08:00-18:00",
		},
	}
}

func mockTerminalsLV() []shipping.Terminal {
	return []shipping.Terminal{
		{
			ID:      "omniva_lv_001",
			Name:    "Riga Central",
			Country: "LV",
			City:    "Riga",
			Address: "Brīvības str. 32, 1010 Riga",
			Lat:     56.9496,
			Lon:     24.1052,
			Hours:   "08:00-20:00",
		},
		{
			ID:      "omniva_lv_002",
			Name:    "Riga Airport",
			Country: "LV",
			City:    "Riga",
			Address: "Mārupes iela 3, 1058 Riga",
			Lat:     56.9236,
			Lon:     24.0534,
			Hours:   "07:00-21:00",
		},
		{
			ID:      "omniva_lv_003",
			Name:    "Daugavpils",
			Country: "LV",
			City:    "Daugavpils",
			Address: "Rīgas iela 32, 5400 Daugavpils",
			Lat:     55.8794,
			Lon:     26.5306,
			Hours:   "08:00-19:00",
		},
	}
}

func mockTerminalsEE() []shipping.Terminal {
	return []shipping.Terminal{
		{
			ID:      "omniva_ee_001",
			Name:    "Tallinn Central",
			Country: "EE",
			City:    "Tallinn",
			Address: "Viru väljak 4, 10111 Tallinn",
			Lat:     59.4370,
			Lon:     24.7431,
			Hours:   "08:00-20:00",
		},
		{
			ID:      "omniva_ee_002",
			Name:    "Tallinn Airport",
			Country: "EE",
			City:    "Tallinn",
			Address: "Lennusadam, 15039 Tallinn",
			Lat:     59.4134,
			Lon:     24.8314,
			Hours:   "07:00-21:00",
		},
		{
			ID:      "omniva_ee_003",
			Name:    "Tartu",
			Country: "EE",
			City:    "Tartu",
			Address: "Rüütli tänav 25, 51007 Tartu",
			Lat:     58.3829,
			Lon:     26.7214,
			Hours:   "08:00-19:00",
		},
	}
}
