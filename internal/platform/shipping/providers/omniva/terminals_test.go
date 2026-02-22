package omniva

import (
	"testing"

	"goecommerce/internal/platform/shipping"
)

func TestNormalizeTerminal(t *testing.T) {
	tests := []struct {
		name     string
		input    omnivaPoint
		expected shipping.Terminal
	}{
		{
			name: "complete terminal data",
			input: omnivaPoint{
				ZIP:          "12345",
				Name:         "Vilnius Central",
				Address:      "Gedimino ave. 9",
				City:         "Vilnius",
				Country:      "LT",
				Postcode:     "01103",
				Latitude:     "54.6872",
				Longitude:    "25.2797",
				WorkingHours: "08:00-20:00",
				Type:         "parcel_locker",
			},
			expected: shipping.Terminal{
				ID:       "12345",
				Name:     "Vilnius Central",
				Country:  "LT",
				City:     "Vilnius",
				Address:  "Gedimino ave. 9",
				Postcode: "01103",
				Lat:      54.6872,
				Lon:      25.2797,
				Hours:    "08:00-20:00",
				Type:     "parcel_locker",
			},
		},
		{
			name: "empty coordinates default to zero",
			input: omnivaPoint{
				ZIP:       "67890",
				Name:      "Test Terminal",
				Address:   "Test Address",
				City:      "Riga",
				Country:   "LV",
				Postcode:  "1010",
				Latitude:  "",
				Longitude: "",
				Type:      "post_office",
			},
			expected: shipping.Terminal{
				ID:       "67890",
				Name:     "Test Terminal",
				Country:  "LV",
				City:     "Riga",
				Address:  "Test Address",
				Postcode: "1010",
				Lat:      0,
				Lon:      0,
				Type:     "post_office",
			},
		},
		{
			name: "missing type defaults to parcel_locker",
			input: omnivaPoint{
				ZIP:     "11111",
				Name:    "Default Type Terminal",
				Address: "Some Address",
				City:    "Tallinn",
				Country: "EE",
				Type:    "",
			},
			expected: shipping.Terminal{
				ID:      "11111",
				Name:    "Default Type Terminal",
				Country: "EE",
				City:    "Tallinn",
				Address: "Some Address",
				Type:    "parcel_locker",
			},
		},
		{
			name: "invalid coordinates parse to zero",
			input: omnivaPoint{
				ZIP:       "22222",
				Name:      "Invalid Coords",
				Address:   "Address",
				City:      "City",
				Country:   "LT",
				Latitude:  "invalid",
				Longitude: "also-invalid",
			},
			expected: shipping.Terminal{
				ID:      "22222",
				Name:    "Invalid Coords",
				Country: "LT",
				City:    "City",
				Address: "Address",
				Lat:     0,
				Lon:     0,
				Type:    "parcel_locker",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeTerminal(tt.input)

			if result.ID != tt.expected.ID {
				t.Errorf("ID: got %s, want %s", result.ID, tt.expected.ID)
			}
			if result.Name != tt.expected.Name {
				t.Errorf("Name: got %s, want %s", result.Name, tt.expected.Name)
			}
			if result.Country != tt.expected.Country {
				t.Errorf("Country: got %s, want %s", result.Country, tt.expected.Country)
			}
			if result.City != tt.expected.City {
				t.Errorf("City: got %s, want %s", result.City, tt.expected.City)
			}
			if result.Address != tt.expected.Address {
				t.Errorf("Address: got %s, want %s", result.Address, tt.expected.Address)
			}
			if result.Postcode != tt.expected.Postcode {
				t.Errorf("Postcode: got %s, want %s", result.Postcode, tt.expected.Postcode)
			}
			if result.Lat != tt.expected.Lat {
				t.Errorf("Lat: got %f, want %f", result.Lat, tt.expected.Lat)
			}
			if result.Lon != tt.expected.Lon {
				t.Errorf("Lon: got %f, want %f", result.Lon, tt.expected.Lon)
			}
			if result.Hours != tt.expected.Hours {
				t.Errorf("Hours: got %s, want %s", result.Hours, tt.expected.Hours)
			}
			if result.Type != tt.expected.Type {
				t.Errorf("Type: got %s, want %s", result.Type, tt.expected.Type)
			}
		})
	}
}

func TestNormalizeTerminals(t *testing.T) {
	points := []omnivaPoint{
		{ZIP: "001", Name: "Terminal 1", Country: "LT", City: "Vilnius"},
		{ZIP: "002", Name: "Terminal 2", Country: "LV", City: "Riga"},
		{ZIP: "003", Name: "Terminal 3", Country: "EE", City: "Tallinn"},
	}

	terminals := normalizeTerminals(points)

	if len(terminals) != 3 {
		t.Fatalf("expected 3 terminals, got %d", len(terminals))
	}

	if terminals[0].ID != "001" {
		t.Errorf("terminal 0 ID: got %s, want 001", terminals[0].ID)
	}
	if terminals[1].ID != "002" {
		t.Errorf("terminal 1 ID: got %s, want 002", terminals[1].ID)
	}
	if terminals[2].ID != "003" {
		t.Errorf("terminal 2 ID: got %s, want 003", terminals[2].ID)
	}
}

func TestFilterByCountry(t *testing.T) {
	terminals := []shipping.Terminal{
		{ID: "001", Country: "LT", City: "Vilnius"},
		{ID: "002", Country: "LT", City: "Kaunas"},
		{ID: "003", Country: "LV", City: "Riga"},
		{ID: "004", Country: "EE", City: "Tallinn"},
		{ID: "005", Country: "LT", City: "Klaipėda"},
	}

	tests := []struct {
		country  string
		expected int
	}{
		{"LT", 3},
		{"LV", 1},
		{"EE", 1},
		{"PL", 0},
		{"lt", 3}, // case insensitive
	}

	for _, tt := range tests {
		t.Run(tt.country, func(t *testing.T) {
			result := filterByCountry(terminals, tt.country)
			if len(result) != tt.expected {
				t.Errorf("country %s: got %d terminals, want %d", tt.country, len(result), tt.expected)
			}
		})
	}
}

func TestFilterByCountryPreservesData(t *testing.T) {
	terminals := []shipping.Terminal{
		{ID: "001", Country: "LT", City: "Vilnius", Name: "Vilnius Central"},
		{ID: "002", Country: "LV", City: "Riga", Name: "Riga Central"},
	}

	ltTerminals := filterByCountry(terminals, "LT")
	if len(ltTerminals) != 1 {
		t.Fatalf("expected 1 LT terminal, got %d", len(ltTerminals))
	}

	if ltTerminals[0].City != "Vilnius" {
		t.Errorf("City: got %s, want Vilnius", ltTerminals[0].City)
	}
	if ltTerminals[0].Name != "Vilnius Central" {
		t.Errorf("Name: got %s, want Vilnius Central", ltTerminals[0].Name)
	}
}
