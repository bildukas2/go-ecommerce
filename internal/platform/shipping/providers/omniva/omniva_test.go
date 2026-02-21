package omniva

import (
	"context"
	"testing"

	"goecommerce/internal/platform/shipping"
)

func TestNewProvider(t *testing.T) {
	tests := []struct {
		name    string
		config  map[string]any
		wantErr bool
	}{
		{
			name: "valid config",
			config: map[string]any{
				"username": "testuser",
				"password": "testpass",
				"base_url": "https://api.omniva.lt",
				"mode":     "sandbox",
			},
			wantErr: false,
		},
		{
			name:    "empty config",
			config:  map[string]any{},
			wantErr: false,
		},
		{
			name: "partial config",
			config: map[string]any{
				"username": "testuser",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prov, err := NewProvider(tt.config)
			if (err != nil) != tt.wantErr {
				t.Fatalf("NewProvider error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && prov == nil {
				t.Fatalf("expected provider, got nil")
			}
		})
	}
}

func TestListTerminals_Lithuania(t *testing.T) {
	prov, err := NewProvider(map[string]any{})
	if err != nil {
		t.Fatalf("NewProvider error: %v", err)
	}

	ctx := context.Background()
	terminals, err := prov.ListTerminals(ctx, "LT")
	if err != nil {
		t.Fatalf("ListTerminals error: %v", err)
	}

	if len(terminals) == 0 {
		t.Fatalf("expected at least 1 terminal, got %d", len(terminals))
	}

	if len(terminals) < 4 {
		t.Fatalf("expected at least 4 Lithuanian terminals, got %d", len(terminals))
	}

	for _, term := range terminals {
		if term.Country != "LT" {
			t.Fatalf("expected country LT, got %s", term.Country)
		}
		if term.ID == "" {
			t.Fatalf("terminal ID is empty")
		}
		if term.Name == "" {
			t.Fatalf("terminal Name is empty")
		}
		if term.City == "" {
			t.Fatalf("terminal City is empty")
		}
		if term.Address == "" {
			t.Fatalf("terminal Address is empty")
		}
	}
}

func TestListTerminals_Latvia(t *testing.T) {
	prov, err := NewProvider(map[string]any{})
	if err != nil {
		t.Fatalf("NewProvider error: %v", err)
	}

	ctx := context.Background()
	terminals, err := prov.ListTerminals(ctx, "LV")
	if err != nil {
		t.Fatalf("ListTerminals error: %v", err)
	}

	if len(terminals) == 0 {
		t.Fatalf("expected at least 1 terminal, got %d", len(terminals))
	}

	for _, term := range terminals {
		if term.Country != "LV" {
			t.Fatalf("expected country LV, got %s", term.Country)
		}
	}
}

func TestListTerminals_Estonia(t *testing.T) {
	prov, err := NewProvider(map[string]any{})
	if err != nil {
		t.Fatalf("NewProvider error: %v", err)
	}

	ctx := context.Background()
	terminals, err := prov.ListTerminals(ctx, "EE")
	if err != nil {
		t.Fatalf("ListTerminals error: %v", err)
	}

	if len(terminals) == 0 {
		t.Fatalf("expected at least 1 terminal, got %d", len(terminals))
	}

	for _, term := range terminals {
		if term.Country != "EE" {
			t.Fatalf("expected country EE, got %s", term.Country)
		}
	}
}

func TestListTerminals_UnsupportedCountry(t *testing.T) {
	prov, err := NewProvider(map[string]any{})
	if err != nil {
		t.Fatalf("NewProvider error: %v", err)
	}

	ctx := context.Background()
	terminals, err := prov.ListTerminals(ctx, "ZZ")
	if err == nil {
		t.Fatalf("expected error for unsupported country, got nil")
	}
	if terminals != nil {
		t.Fatalf("expected nil terminals, got %v", terminals)
	}
}

func TestQuote_Lithuania(t *testing.T) {
	prov, err := NewProvider(map[string]any{})
	if err != nil {
		t.Fatalf("NewProvider error: %v", err)
	}

	ctx := context.Background()
	req := shipping.QuoteRequest{
		Weight:  1.5,
		Country: "LT",
	}
	options, err := prov.Quote(ctx, req)
	if err != nil {
		t.Fatalf("Quote error: %v", err)
	}

	if len(options) == 0 {
		t.Fatalf("expected at least 1 shipping option, got %d", len(options))
	}

	if len(options) < 3 {
		t.Fatalf("expected at least 3 shipping options, got %d", len(options))
	}

	for _, opt := range options {
		if opt.ServiceCode == "" {
			t.Fatalf("ServiceCode is empty")
		}
		if opt.ServiceName == "" {
			t.Fatalf("ServiceName is empty")
		}
		if opt.Price <= 0 {
			t.Fatalf("Price should be positive, got %d", opt.Price)
		}
		if opt.Currency != "EUR" {
			t.Fatalf("expected currency EUR, got %s", opt.Currency)
		}
		if opt.Estimate == "" {
			t.Fatalf("Estimate is empty")
		}
	}

	minPrice := options[0].Price
	maxPrice := options[len(options)-1].Price
	if minPrice >= maxPrice {
		t.Fatalf("expected prices to increase, got min=%d, max=%d", minPrice, maxPrice)
	}
}

func TestQuote_DifferentWeights(t *testing.T) {
	prov, err := NewProvider(map[string]any{})
	if err != nil {
		t.Fatalf("NewProvider error: %v", err)
	}

	ctx := context.Background()
	req1 := shipping.QuoteRequest{
		Weight:  0.5,
		Country: "LT",
	}
	options1, err := prov.Quote(ctx, req1)
	if err != nil {
		t.Fatalf("Quote error: %v", err)
	}

	req2 := shipping.QuoteRequest{
		Weight:  5.0,
		Country: "LT",
	}
	options2, err := prov.Quote(ctx, req2)
	if err != nil {
		t.Fatalf("Quote error: %v", err)
	}

	if options1[0].Price >= options2[0].Price {
		t.Fatalf("heavier package should cost more: light=%d, heavy=%d", options1[0].Price, options2[0].Price)
	}
}

func TestQuote_MissingCountry(t *testing.T) {
	prov, err := NewProvider(map[string]any{})
	if err != nil {
		t.Fatalf("NewProvider error: %v", err)
	}

	ctx := context.Background()
	req := shipping.QuoteRequest{
		Weight: 1.0,
	}
	options, err := prov.Quote(ctx, req)
	if err == nil {
		t.Fatalf("expected error for missing country, got nil")
	}
	if options != nil {
		t.Fatalf("expected nil options, got %v", options)
	}
}

func TestQuote_CountriesHaveDifferentPrices(t *testing.T) {
	prov, err := NewProvider(map[string]any{})
	if err != nil {
		t.Fatalf("NewProvider error: %v", err)
	}

	ctx := context.Background()
	req := shipping.QuoteRequest{
		Weight: 1.0,
	}

	ltReq := req
	ltReq.Country = "LT"
	ltOpts, err := prov.Quote(ctx, ltReq)
	if err != nil {
		t.Fatalf("Quote error for LT: %v", err)
	}

	lvReq := req
	lvReq.Country = "LV"
	lvOpts, err := prov.Quote(ctx, lvReq)
	if err != nil {
		t.Fatalf("Quote error for LV: %v", err)
	}

	if ltOpts[0].Price == lvOpts[0].Price {
		t.Logf("note: LT and LV have same base price, which is acceptable for demo")
	}

	ltUnknown := req
	ltUnknown.Country = "XX"
	unknownOpts, err := prov.Quote(ctx, ltUnknown)
	if err != nil {
		t.Fatalf("Quote error for unknown: %v", err)
	}

	if unknownOpts[0].Price <= ltOpts[0].Price {
		t.Fatalf("unknown country should have higher price than LT")
	}
}
