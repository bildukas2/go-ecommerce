package lpexpress

import (
	"context"
	"fmt"
	"strings"

	"goecommerce/internal/platform/shipping"
)

const (
	defaultSandboxBaseURL = "https://api-manosiuntostst.post.lt"
	defaultLiveBaseURL    = "https://api-manosiuntos.post.lt"
)

type provider struct {
	username string
	password string
	baseURL  string
	mode     string
}

func NewProvider(config map[string]any) (shipping.Provider, error) {
	username := stringFromConfig(config, "username")
	password := stringFromConfig(config, "password")
	mode := strings.ToLower(strings.TrimSpace(stringFromConfig(config, "mode")))
	baseURL := strings.TrimSpace(stringFromConfig(config, "base_url"))

	if mode == "" {
		mode = "sandbox"
	}
	if mode != "sandbox" && mode != "live" {
		return nil, fmt.Errorf("invalid mode: %s", mode)
	}

	if baseURL == "" {
		if mode == "live" {
			baseURL = defaultLiveBaseURL
		} else {
			baseURL = defaultSandboxBaseURL
		}
	}

	return &provider{
		username: username,
		password: password,
		baseURL:  strings.TrimSpace(baseURL),
		mode:     mode,
	}, nil
}

func init() {
	shipping.Register("lpexpress", NewProvider)
}

func (p *provider) Key() string {
	return "lpexpress"
}

func (p *provider) Name() string {
	return "LP EXPRESS"
}

func (p *provider) Capabilities() shipping.Capabilities {
	return shipping.Capabilities{
		Terminals:      true,
		CreateShipment: false,
		Labels:         false,
		Tracking:       false,
		Pickup:         false,
	}
}

func (p *provider) ListTerminals(ctx context.Context, country string) ([]shipping.Terminal, error) {
	if strings.TrimSpace(p.username) == "" || strings.TrimSpace(p.password) == "" {
		return nil, fmt.Errorf("lpexpress credentials are required")
	}

	normalizedCountry := strings.ToUpper(strings.TrimSpace(country))
	if normalizedCountry == "" {
		return nil, fmt.Errorf("country is required")
	}

	client := NewClient(p.username, p.password, p.baseURL)
	points, err := client.FetchTerminalsByCountry(ctx, normalizedCountry)
	if err != nil {
		return nil, fmt.Errorf("lpexpress terminal fetch failed: %w", err)
	}

	return normalizeTerminals(points, normalizedCountry), nil
}

func stringFromConfig(config map[string]any, key string) string {
	if config == nil {
		return ""
	}
	raw, ok := config[key]
	if !ok {
		return ""
	}
	s, ok := raw.(string)
	if !ok {
		return ""
	}
	return s
}
