package settings

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storeshop "goecommerce/internal/storage/shop"
)

type updateShopSettingsRequest struct {
	Currency string `json:"currency"`
}

func (m *module) handleAdminShopSettings(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/admin/settings/shop" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		item, err := m.store.GetSettings(r.Context())
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "get settings error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, item)
	case http.MethodPut:
		var req updateShopSettingsRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		in, err := validateUpdateShopSettingsRequest(req)
		if err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := m.store.UpdateSettings(r.Context(), in)
		if err != nil {
			if errors.Is(err, storeshop.ErrNotFound) {
				platformhttp.Error(w, http.StatusNotFound, "not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "update settings error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, item)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleStorefrontShopSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || r.URL.Path != "/settings/shop" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	item, err := m.store.GetSettings(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get settings error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, item)
}

func validateUpdateShopSettingsRequest(req updateShopSettingsRequest) (storeshop.UpdateSettingsInput, error) {
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if len(currency) != 3 {
		return storeshop.UpdateSettingsInput{}, errors.New("currency must be a 3-letter ISO code")
	}
	for _, ch := range currency {
		if ch < 'A' || ch > 'Z' {
			return storeshop.UpdateSettingsInput{}, errors.New("currency must contain only letters")
		}
	}
	return storeshop.UpdateSettingsInput{Currency: currency}, nil
}

func decodeRequest(r *http.Request, dst any) error {
	defer r.Body.Close()
	const maxBodyBytes = 1 << 20
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		return errors.New("invalid json body")
	}
	if len(body) == 0 {
		return errors.New("request body is required")
	}
	if len(body) > maxBodyBytes {
		return errors.New("request body too large")
	}

	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("request body is required")
		}
		return errors.New("invalid json body")
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return errors.New("invalid json body")
	}
	return nil
}
