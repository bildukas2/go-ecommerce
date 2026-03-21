package lpexpress

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// scopeValue matches the PHP plugin: "read+write+API_CLIENT" sent literally.
const scopeValue = "read+write+API_CLIENT"

const (
	defaultTimeout = 30 * time.Second
)

type Client struct {
	httpClient *http.Client
	username   string
	password   string
	baseURL    string
}

type authResponse struct {
	AccessToken string `json:"access_token"`
}

type errorResponse struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
	Message          string `json:"message"`
}

type terminalPoint struct {
	ID          string `json:"id"`
	TerminalID  string `json:"terminalId"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Title       string `json:"title"`
	Address     string `json:"address"`
	Street      string `json:"street"`
	City        string `json:"city"`
	Locality    string `json:"locality"`
	Country     string `json:"country"`
	CountryCode string `json:"countryCode"`
	Postcode    string `json:"postcode"`
	PostalCode  string `json:"postalCode"`
	Zip         string `json:"zip"`
	Lat         any    `json:"lat"`
	Latitude    any    `json:"latitude"`
	Lon         any    `json:"lon"`
	Longitude   any    `json:"longitude"`
	Hours       string `json:"hours"`
	WorkingTime string `json:"workingHours"`
	ServiceTime string `json:"serviceHours"`
	Type        string `json:"type"`
}

func NewClient(username, password, baseURL string) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: defaultTimeout},
		username:   username,
		password:   password,
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
	}
}

func (c *Client) FetchTerminalsByCountry(ctx context.Context, country string) ([]terminalPoint, error) {
	token, err := c.authenticate(ctx)
	if err != nil {
		return nil, err
	}

	reqURL := c.baseURL + "/api/v2/terminal?receiverCountryCode=" + url.QueryEscape(country) + "&size=999"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build terminal request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute terminal request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("terminal api error: %s", c.describeAPIError(resp))
	}

	var points []terminalPoint
	if err := json.NewDecoder(resp.Body).Decode(&points); err != nil {
		return nil, fmt.Errorf("decode terminals response: %w", err)
	}

	return points, nil
}

func (c *Client) authenticate(ctx context.Context) (string, error) {
	form := url.Values{}
	form.Set("grant_type", "password")
	form.Set("clientSystem", "public")
	form.Set("username", c.username)
	form.Set("password", c.password)
	// Scope must be sent literally as "read+write+API_CLIENT" — do NOT let
	// url.Values encode the '+' signs as spaces.
	formEncoded := form.Encode() + "&scope=" + scopeValue

	reqURL := c.baseURL + "/oauth/token"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, strings.NewReader(formEncoded))
	if err != nil {
		return "", fmt.Errorf("build auth request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute auth request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		return "", fmt.Errorf("auth api error: %s", c.describeAPIError(resp))
	}

	var body authResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("decode auth response: %w", err)
	}
	if strings.TrimSpace(body.AccessToken) == "" {
		return "", fmt.Errorf("auth api error: missing access token")
	}

	return body.AccessToken, nil
}

func (c *Client) describeAPIError(resp *http.Response) string {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if len(body) == 0 {
		return fmt.Sprintf("status %d", resp.StatusCode)
	}

	var payload errorResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Sprintf("status %d", resp.StatusCode)
	}

	detail := strings.TrimSpace(payload.ErrorDescription)
	if detail == "" {
		detail = strings.TrimSpace(payload.Message)
	}
	if detail == "" {
		detail = strings.TrimSpace(payload.Error)
	}
	if detail == "" {
		return fmt.Sprintf("status %d", resp.StatusCode)
	}

	return fmt.Sprintf("status %d: %s", resp.StatusCode, detail)
}
