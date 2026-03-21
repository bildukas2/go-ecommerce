package lpexpress

import (
	"strconv"
	"strings"

	"goecommerce/internal/platform/shipping"
)

func normalizeTerminals(points []terminalPoint, fallbackCountry string) []shipping.Terminal {
	terminals := make([]shipping.Terminal, 0, len(points))
	for _, point := range points {
		terminals = append(terminals, normalizeTerminal(point, fallbackCountry))
	}
	return terminals
}

func normalizeTerminal(point terminalPoint, fallbackCountry string) shipping.Terminal {
	country := firstNonEmpty(point.CountryCode, point.Country, fallbackCountry)
	country = strings.ToUpper(strings.TrimSpace(country))

	city := firstNonEmpty(point.City, point.Locality)
	address := normalizeAddress(point)
	postcode := firstNonEmpty(point.Postcode, point.PostalCode, point.Zip)
	lat := parseFloat(point.Latitude, point.Lat)
	lon := parseFloat(point.Longitude, point.Lon)
	id := normalizeTerminalID(point, postcode, country)
	name := firstNonEmpty(point.Name, point.Title, id)
	hours := firstNonEmpty(point.Hours, point.WorkingTime, point.ServiceTime)

	return shipping.Terminal{
		ID:       id,
		Name:     name,
		Country:  country,
		City:     city,
		Address:  address,
		Postcode: postcode,
		Lat:      lat,
		Lon:      lon,
		Hours:    hours,
		Type:     normalizeType(point.Type),
	}
}

func normalizeTerminalID(point terminalPoint, postcode, country string) string {
	id := firstNonEmpty(point.ID, point.TerminalID, point.Code)
	if id != "" {
		return id
	}
	if postcode != "" {
		return strings.ToUpper(strings.TrimSpace(country)) + "-" + strings.TrimSpace(postcode)
	}
	return strings.TrimSpace(point.Name)
}

func normalizeAddress(point terminalPoint) string {
	if strings.TrimSpace(point.Address) != "" {
		return strings.TrimSpace(point.Address)
	}

	street := strings.TrimSpace(point.Street)
	city := strings.TrimSpace(firstNonEmpty(point.City, point.Locality))
	if street != "" && city != "" {
		return street + ", " + city
	}
	return firstNonEmpty(street, city)
}

func normalizeType(rawType string) string {
	t := strings.ToLower(strings.TrimSpace(rawType))
	switch t {
	case "", "terminal", "locker", "parcel_terminal", "parcel terminal", "postomatas", "postomat":
		return "parcel_locker"
	case "post_office", "post-office", "post office":
		return "post_office"
	case "pickup", "pickup_point", "pickup-point":
		return "pickup_point"
	default:
		return t
	}
}

func parseFloat(values ...any) float64 {
	for _, value := range values {
		switch v := value.(type) {
		case float64:
			return v
		case float32:
			return float64(v)
		case int:
			return float64(v)
		case int64:
			return float64(v)
		case string:
			if strings.TrimSpace(v) == "" {
				continue
			}
			parsed, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
			if err == nil {
				return parsed
			}
		}
	}
	return 0
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}
