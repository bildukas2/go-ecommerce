package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"

	platformdb "goecommerce/internal/platform/db"
	"goecommerce/internal/platform/shipping"
	storeshipping "goecommerce/internal/storage/shipping"

	"github.com/joho/godotenv"
)

const (
	defaultCSVPath  = "csv/LpExpressTerminals.csv"
	providerKey     = "lpexpress"
	expectedColumns = 10 // id,countryCode,name,city,address,postalCode,latitude,longitude,updated,comment
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("No .env file found: %v", err)
	}

	csvPath := defaultCSVPath
	if len(os.Args) > 1 {
		csvPath = os.Args[1]
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx := context.Background()

	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		log.Fatalf("db connect error: %v", err)
	}
	defer db.Close()

	store, err := storeshipping.NewStore(ctx, db)
	if err != nil {
		log.Fatalf("store init error: %v", err)
	}

	// Read CSV
	raw, err := os.ReadFile(csvPath)
	if err != nil {
		log.Fatalf("read csv: %v", err)
	}

	// Strip BOM if present
	content := string(raw)
	content = strings.TrimPrefix(content, "\xef\xbb\xbf")

	lines := strings.Split(content, "\n")
	if len(lines) < 2 {
		log.Fatal("csv file is empty or has no data rows")
	}

	// Skip header
	lines = lines[1:]

	// Parse and group by country
	byCountry := map[string][]shipping.Terminal{}
	var parsed, skipped int

	for lineNum, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		terminal, err := parseCSVLine(line)
		if err != nil {
			log.Printf("line %d: skip: %v", lineNum+2, err)
			skipped++
			continue
		}

		byCountry[terminal.Country] = append(byCountry[terminal.Country], *terminal)
		parsed++
	}

	log.Printf("parsed %d terminals, skipped %d", parsed, skipped)

	// Upsert each country group into cache
	for country, terminals := range byCountry {
		payload, err := json.Marshal(terminals)
		if err != nil {
			log.Fatalf("marshal %s: %v", country, err)
		}

		if err := store.UpsertCachedTerminals(ctx, providerKey, country, payload); err != nil {
			log.Fatalf("upsert %s: %v", country, err)
		}

		log.Printf("  %s: %d terminals", country, len(terminals))
	}

	log.Printf("done — %d countries updated for provider %q", len(byCountry), providerKey)
}

// timestampRe matches the "updated" column: YYYY-MM-DD HH:MM:SS.nnn
var timestampRe = regexp.MustCompile(`\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+`)

// parseCSVLine parses a CSV line where address, name, or comment may contain commas.
//
// Strategy: find the "updated" timestamp in the line — it's always present and
// has a unique format. Then work backwards from the timestamp to find lat, lon,
// postalCode, and address; the first 4 comma-separated fields are always clean
// (id, countryCode, name… but name can also contain commas for some rows).
//
// Reliable structure from the timestamp anchor:
//
//	...,postalCode,latitude,longitude,TIMESTAMP,...
//
// So we find the timestamp, take everything before it, and parse the tail fields
// (lon, lat, postalCode) in reverse. The remaining middle part between field index 1
// (countryCode) and postalCode contains name+city+address which we split knowing
// countryCode is always 2 chars and the pattern is: id,CC,name,city,address,postal,...
func parseCSVLine(line string) (*shipping.Terminal, error) {
	// Find the timestamp position to anchor our parsing.
	// If no timestamp, the line ends with ",,<comment>" or ",," — strip trailing
	// empty fields and parse the remaining columns.
	tsLoc := timestampRe.FindStringIndex(line)
	var before string
	if tsLoc != nil {
		before = strings.TrimRight(line[:tsLoc[0]], ",")
	} else {
		// No timestamp — trim trailing commas/empty fields
		before = strings.TrimRight(line, ",")
	}

	parts := strings.Split(before, ",")
	if len(parts) < 7 {
		return nil, fmt.Errorf("too few columns before timestamp: got %d", len(parts))
	}

	// From the end of `before`: lon, lat, postalCode
	n := len(parts)
	lonStr := strings.TrimSpace(parts[n-1])
	latStr := strings.TrimSpace(parts[n-2])
	postalCode := strings.TrimSpace(parts[n-3])

	// From the start: id, countryCode are always clean single fields
	id := strings.TrimSpace(parts[0])
	countryCode := strings.ToUpper(strings.TrimSpace(parts[1]))

	// Middle section: parts[2 .. n-4] contains name, city, address
	// City is typically the field right before address. Name is parts[2] for most rows,
	// but can contain commas (e.g. "Vasaris, PC"). Address can also contain commas.
	// Heuristic: city is a single word/short field before the address. We take parts[2]
	// as name-start and parts[n-4] as address-end, with city at a fixed offset.
	//
	// Since the original CSV columns are: id,countryCode,name,city,address,postalCode,...
	// and city rarely contains commas while both name and address can, we parse:
	// - parts[2] through the middle: split at the city boundary
	//
	// Better approach: the middle has at least 3 fields (name, city, address).
	// City is typically at index 3 in the original CSV. Since id=0, countryCode=1,
	// name starts at 2. If name has no commas, city=parts[3], address=parts[4..n-4].
	// If name has commas, we need to figure out where city is.
	//
	// Practical solution: try parsing with city at different positions.
	// For the vast majority of rows, name has no commas → city = parts[3].
	// For the few rows where name has commas, city = parts[4] or later.
	middle := parts[2 : n-3]

	var name, city, address string
	if len(middle) >= 3 {
		// Default: name = middle[0], city = middle[1], address = rest
		name = strings.TrimSpace(middle[0])
		city = strings.TrimSpace(middle[1])
		address = strings.TrimSpace(strings.Join(middle[2:], ","))
	} else if len(middle) == 2 {
		name = strings.TrimSpace(middle[0])
		city = strings.TrimSpace(middle[1])
	} else if len(middle) == 1 {
		name = strings.TrimSpace(middle[0])
	}

	if id == "" || countryCode == "" || name == "" {
		return nil, fmt.Errorf("missing required field: id=%q country=%q name=%q", id, countryCode, name)
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		return nil, fmt.Errorf("parse latitude %q: %w", latStr, err)
	}
	lon, err := strconv.ParseFloat(lonStr, 64)
	if err != nil {
		return nil, fmt.Errorf("parse longitude %q: %w", lonStr, err)
	}

	return &shipping.Terminal{
		ID:       id,
		Name:     name,
		Country:  countryCode,
		City:     city,
		Address:  address,
		Postcode: postalCode,
		Lat:      lat,
		Lon:      lon,
		Type:     "parcel_locker",
	}, nil
}
