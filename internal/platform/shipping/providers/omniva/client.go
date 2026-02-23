package omniva

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	defaultTimeout = 30 * time.Second
)

// Client handles HTTP communication with Omniva public JSON endpoints
type Client struct {
	httpClient *http.Client
	username   string
	password   string
}

// NewClient creates a new Omniva client
func NewClient(username, password, baseURL string) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
		username: username,
		password: password,
	}
}

// SetTimeout configures the HTTP client timeout
func (c *Client) SetTimeout(d time.Duration) {
	c.httpClient.Timeout = d
}

// omnivaLocation represents a parcel terminal from Omniva public JSON
type omnivaLocation struct {
	ZIP                 string `json:"ZIP"`
	NAME                string `json:"NAME"`
	TYPE                string `json:"TYPE"`
	A0NAME              string `json:"A0_NAME"`
	A1NAME              string `json:"A1_NAME"`
	A2NAME              string `json:"A2_NAME"`
	A3NAME              string `json:"A3_NAME"`
	A4NAME              string `json:"A4_NAME"`
	A5NAME              string `json:"A5_NAME"`
	A6NAME              string `json:"A6_NAME"`
	A7NAME              string `json:"A7_NAME"`
	A8NAME              string `json:"A8_NAME"`
	XCOORDINATE         string `json:"X_COORDINATE"`
	YCOORDINATE         string `json:"Y_COORDINATE"`
	SERVICEHOURS        string `json:"SERVICE_HOURS"`
	TEMPSERVICEHOURS    string `json:"TEMP_SERVICE_HOURS"`
	TEMPSERVICEHOURSUNT string `json:"TEMP_SERVICE_HOURS_UNTIL"`
}

// omnivaPoint represents a normalized terminal for internal use
type omnivaPoint struct {
	ZIP          string
	Name         string
	Address      string
	City         string
	Country      string
	Postcode     string
	Latitude     string
	Longitude    string
	WorkingHours string
	Type         string
}

// FetchTerminalsByCountry fetches parcel terminals from Omniva public JSON endpoint for a specific country
func (c *Client) FetchTerminalsByCountry(ctx context.Context, country string) ([]omnivaPoint, error) {
	country = strings.ToUpper(country)

	// Map countries to Omniva public endpoints
	var url string
	switch country {
	case "LT":
		url = "https://www.omniva.lt/locations.json"
	case "LV":
		url = "https://www.omniva.lv/locations.json"
	case "EE":
		url = "https://www.omniva.ee/locations.json"
	default:
		return nil, fmt.Errorf("unsupported country: %s", country)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	var locations []omnivaLocation
	if err := json.NewDecoder(resp.Body).Decode(&locations); err != nil {
		return nil, fmt.Errorf("parsing terminals response: %w", err)
	}

	// Filter and normalize locations for the country
	points := make([]omnivaPoint, 0)
	for _, loc := range locations {
		if strings.ToUpper(loc.A0NAME) != country {
			continue
		}

		// Build address from components A0-A8
		addressParts := []string{}
		for _, part := range []string{loc.A5NAME, loc.A7NAME} {
			if strings.TrimSpace(part) != "" {
				addressParts = append(addressParts, strings.TrimSpace(part))
			}
		}

		address := strings.Join(addressParts, ", ")
		if address == "" {
			address = loc.NAME
		}

		point := omnivaPoint{
			ZIP:          loc.ZIP,
			Name:         loc.NAME,
			Address:      address,
			City:         loc.A3NAME,
			Country:      loc.A0NAME,
			Postcode:     loc.ZIP,
			Latitude:     loc.XCOORDINATE,
			Longitude:    loc.YCOORDINATE,
			WorkingHours: loc.SERVICEHOURS,
			Type:         "0", // parcel_locker by default
		}

		points = append(points, point)
	}

	return points, nil
}

// FetchTerminals fetches terminals (deprecated, use FetchTerminalsByCountry)
func (c *Client) FetchTerminals(ctx context.Context) ([]omnivaPoint, error) {
	return nil, fmt.Errorf("use FetchTerminalsByCountry instead")
}

// TestConnection tests the API connection by attempting to fetch terminals for LT
func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.FetchTerminalsByCountry(ctx, "LT")
	if err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}
	return nil
}
