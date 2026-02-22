package omniva

import (
	"context"
	"strconv"
	"strings"

	"goecommerce/internal/platform/shipping"
)

// normalizeTerminal converts an Omniva API terminal to our Terminal struct
func normalizeTerminal(p omnivaPoint) shipping.Terminal {
	lat, _ := strconv.ParseFloat(p.Latitude, 64)
	lon, _ := strconv.ParseFloat(p.Longitude, 64)

	terminalType := p.Type
	if terminalType == "" {
		terminalType = "parcel_locker"
	}

	return shipping.Terminal{
		ID:       p.ZIP,
		Name:     p.Name,
		Country:  p.Country,
		City:     p.City,
		Address:  p.Address,
		Postcode: p.Postcode,
		Lat:      lat,
		Lon:      lon,
		Hours:    p.WorkingHours,
		Type:     terminalType,
	}
}

// normalizeTerminals converts a list of Omniva terminals to our format
func normalizeTerminals(points []omnivaPoint) []shipping.Terminal {
	terminals := make([]shipping.Terminal, 0, len(points))
	for _, p := range points {
		terminals = append(terminals, normalizeTerminal(p))
	}
	return terminals
}

// filterByCountry filters terminals by country code
func filterByCountry(terminals []shipping.Terminal, country string) []shipping.Terminal {
	country = strings.ToUpper(country)
	result := make([]shipping.Terminal, 0)
	for _, t := range terminals {
		if strings.ToUpper(t.Country) == country {
			result = append(result, t)
		}
	}
	return result
}

// fetchAndCacheTerminals fetches terminals from API and caches them
func (p *omnivaProvider) fetchTerminalsFromAPI(ctx context.Context) ([]shipping.Terminal, error) {
	if p.username == "" || p.password == "" {
		// No credentials configured, use mock data
		return nil, nil
	}

	client := NewClient(p.username, p.password, p.baseURL)

	points, err := client.FetchTerminals(ctx)
	if err != nil {
		return nil, err
	}

	return normalizeTerminals(points), nil
}

// TestConnection tests the provider connection
func (p *omnivaProvider) TestConnection(ctx context.Context) error {
	if p.username == "" || p.password == "" {
		return nil // No credentials to test
	}

	client := NewClient(p.username, p.password, p.baseURL)
	return client.TestConnection(ctx)
}

// ListTerminalsFromAPI fetches terminals from the real Omniva API
// Returns nil if credentials are not configured (caller should use mock data)
func (p *omnivaProvider) ListTerminalsFromAPI(ctx context.Context, country string) ([]shipping.Terminal, error) {
	terminals, err := p.fetchTerminalsFromAPI(ctx)
	if err != nil {
		return nil, err
	}

	if terminals == nil {
		return nil, nil // No API credentials
	}

	return filterByCountry(terminals, country), nil
}
