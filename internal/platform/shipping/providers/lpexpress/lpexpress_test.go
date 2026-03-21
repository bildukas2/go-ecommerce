package lpexpress

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewProviderDefaultsAndValidation(t *testing.T) {
	t.Run("defaults with nil config", func(t *testing.T) {
		prov, err := NewProvider(nil)
		if err != nil {
			t.Fatalf("NewProvider error = %v", err)
		}

		lp, ok := prov.(*provider)
		if !ok {
			t.Fatalf("provider type assertion failed")
		}

		if lp.mode != "sandbox" {
			t.Fatalf("mode = %s, want sandbox", lp.mode)
		}
		if lp.baseURL != defaultSandboxBaseURL {
			t.Fatalf("baseURL = %s, want %s", lp.baseURL, defaultSandboxBaseURL)
		}
	})

	t.Run("live mode default base url", func(t *testing.T) {
		prov, err := NewProvider(map[string]any{
			"mode":     "live",
			"username": "user",
			"password": "pass",
		})
		if err != nil {
			t.Fatalf("NewProvider error = %v", err)
		}

		lp := prov.(*provider)
		if lp.baseURL != defaultLiveBaseURL {
			t.Fatalf("baseURL = %s, want %s", lp.baseURL, defaultLiveBaseURL)
		}
	})

	t.Run("invalid mode", func(t *testing.T) {
		_, err := NewProvider(map[string]any{"mode": "invalid"})
		if err == nil {
			t.Fatalf("expected invalid mode error")
		}
	})
}

func TestListTerminalsRequiresCredentials(t *testing.T) {
	prov, err := NewProvider(map[string]any{
		"mode": "sandbox",
	})
	if err != nil {
		t.Fatalf("NewProvider error = %v", err)
	}

	_, err = prov.ListTerminals(context.Background(), "LT")
	if err == nil {
		t.Fatalf("expected credentials error")
	}
	if !strings.Contains(err.Error(), "credentials are required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestNormalizeTerminalHandlesPartialFields(t *testing.T) {
	terminal := normalizeTerminal(terminalPoint{
		TerminalID: "123",
		Name:       "Main LP Terminal",
		Street:     "Gedimino pr. 1",
		Locality:   "Vilnius",
		PostalCode: "01103",
		Latitude:   "54.6872",
		Longitude:  "25.2797",
		Type:       "",
	}, "lt")

	if terminal.ID != "123" {
		t.Fatalf("ID = %s, want 123", terminal.ID)
	}
	if terminal.Country != "LT" {
		t.Fatalf("Country = %s, want LT", terminal.Country)
	}
	if terminal.Address != "Gedimino pr. 1, Vilnius" {
		t.Fatalf("Address = %s", terminal.Address)
	}
	if terminal.Type != "parcel_locker" {
		t.Fatalf("Type = %s, want parcel_locker", terminal.Type)
	}
	if terminal.Lat == 0 || terminal.Lon == 0 {
		t.Fatalf("expected parsed coordinates, got lat=%f lon=%f", terminal.Lat, terminal.Lon)
	}
}

func TestNormalizeTerminalMissingFieldsFallbacks(t *testing.T) {
	terminal := normalizeTerminal(terminalPoint{
		Name: "Fallback Name",
		City: "Kaunas",
	}, "LT")

	if terminal.ID != "Fallback Name" {
		t.Fatalf("ID = %s, want fallback name", terminal.ID)
	}
	if terminal.Name != "Fallback Name" {
		t.Fatalf("Name = %s, want fallback name", terminal.Name)
	}
	if terminal.Country != "LT" {
		t.Fatalf("Country = %s, want LT", terminal.Country)
	}
}

func TestListTerminalsReturnsSafeErrorOnUpstreamFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/oauth/token") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error_description":"bad credentials for test-user"}`))
			return
		}

		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	prov, err := NewProvider(map[string]any{
		"mode":     "sandbox",
		"base_url": server.URL,
		"username": "test-user",
		"password": "test-password",
	})
	if err != nil {
		t.Fatalf("NewProvider error = %v", err)
	}

	_, err = prov.ListTerminals(context.Background(), "LT")
	if err == nil {
		t.Fatalf("expected upstream failure error")
	}

	if err.Error() != "lpexpress terminal fetch failed" {
		t.Fatalf("error = %q, want generic provider error", err.Error())
	}
	if strings.Contains(err.Error(), "test-password") || strings.Contains(err.Error(), "test-user") {
		t.Fatalf("error leaked credentials: %q", err.Error())
	}
}
