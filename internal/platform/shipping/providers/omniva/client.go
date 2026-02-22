package omniva

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	defaultSandboxURL = "https://sandbox.omniva.lt/api"
	defaultLiveURL    = "https://api.omniva.lt"
	defaultTimeout    = 30 * time.Second
)

// Client handles HTTP communication with Omniva API
type Client struct {
	httpClient *http.Client
	baseURL    string
	username   string
	password   string
}

// NewClient creates a new Omniva API client
func NewClient(username, password, baseURL string) *Client {
	if baseURL == "" {
		baseURL = defaultSandboxURL
	}

	return &Client{
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
		baseURL:  baseURL,
		username: username,
		password: password,
	}
}

// SetTimeout configures the HTTP client timeout
func (c *Client) SetTimeout(d time.Duration) {
	c.httpClient.Timeout = d
}

// doRequest performs an HTTP request with basic auth
func (c *Client) doRequest(ctx context.Context, method, path string, body []byte) ([]byte, error) {
	url := c.baseURL + path

	var reqBody io.Reader
	if body != nil {
		reqBody = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	// Omniva uses basic authentication
	req.SetBasicAuth(c.username, c.password)

	if body != nil {
		req.Header.Set("Content-Type", "application/xml")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// omnivaPoint represents a parcel terminal from Omniva API
type omnivaPoint struct {
	ZIP          string `xml:"zip"`
	Name         string `xml:"name"`
	Address      string `xml:"address"`
	City         string `xml:"city"`
	Country      string `xml:"country"`
	Postcode     string `xml:"postcode"`
	Latitude     string `xml:"latitude"`
	Longitude    string `xml:"longitude"`
	WorkingHours string `xml:"working_hours"`
	Type         string `xml:"type"` // parcel_locker, post_office
}

// omnivaPointsResponse represents the XML response from Omniva terminals endpoint
type omnivaPointsResponse struct {
	Points []omnivaPoint `xml:"point"`
}

// FetchTerminals fetches parcel terminals from Omniva API
func (c *Client) FetchTerminals(ctx context.Context) ([]omnivaPoint, error) {
	// Omniva provides a public endpoint for parcel machines
	// The endpoint is typically: /locations.json or similar
	// For now, we'll use the XML endpoint
	path := "/locations"

	respBody, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("fetching terminals: %w", err)
	}

	var response omnivaPointsResponse
	if err := xml.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("parsing terminals response: %w", err)
	}

	return response.Points, nil
}

// TestConnection tests the API connection by attempting to fetch terminals
func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.FetchTerminals(ctx)
	if err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}
	return nil
}
