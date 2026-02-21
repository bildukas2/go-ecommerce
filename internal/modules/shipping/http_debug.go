package shipping

import (
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
)

type pingResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type debugTerminalsResponse struct {
	Provider  string                   `json:"provider"`
	Country   string                   `json:"country"`
	Terminals []map[string]interface{} `json:"terminals"`
}

func (m *module) handleDebugOmnivaPing(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		platformhttp.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	provider, ok := m.providers["omniva"]
	if !ok {
		_ = platformhttp.JSON(w, http.StatusOK, pingResponse{
			Status:  "unavailable",
			Message: "Omniva provider not initialized",
		})
		return
	}

	if provider == nil {
		_ = platformhttp.JSON(w, http.StatusOK, pingResponse{
			Status:  "error",
			Message: "Omniva provider is nil",
		})
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, pingResponse{
		Status:  "ok",
		Message: "Omniva provider is configured and ready",
	})
}

func (m *module) handleDebugOmnivaNTerminals(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		platformhttp.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	country := strings.TrimSpace(r.URL.Query().Get("country"))
	if country == "" {
		platformhttp.Error(w, http.StatusBadRequest, "country is required")
		return
	}

	provider, ok := m.providers["omniva"]
	if !ok {
		platformhttp.Error(w, http.StatusNotFound, "Omniva provider not initialized")
		return
	}

	terminals, err := provider.ListTerminals(r.Context(), country)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "error fetching terminals: "+err.Error())
		return
	}

	terminalMaps := make([]map[string]interface{}, len(terminals))
	for i, t := range terminals {
		terminalMaps[i] = map[string]interface{}{
			"id":      t.ID,
			"name":    t.Name,
			"country": t.Country,
			"city":    t.City,
			"address": t.Address,
			"lat":     t.Lat,
			"lon":     t.Lon,
			"hours":   t.Hours,
		}
	}

	_ = platformhttp.JSON(w, http.StatusOK, debugTerminalsResponse{
		Provider:  "omniva",
		Country:   country,
		Terminals: terminalMaps,
	})
}
