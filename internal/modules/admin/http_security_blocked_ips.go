package admin

import (
	"errors"
	"net"
	"net/http"
	"strings"
	"time"

	platformhttp "goecommerce/internal/platform/http"
	storcustomers "goecommerce/internal/storage/customers"
)

type createBlockedIPRequest struct {
	IP        string  `json:"ip"`
	Reason    *string `json:"reason"`
	ExpiresAt *string `json:"expires_at"`
}

func (m *module) handleBlockedIPs(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/admin/security/blocked-ips" {
		http.NotFound(w, r)
		return
	}
	if m.customers == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		items, err := m.customers.ListBlockedIPs(r.Context())
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "list blocked ips error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
		return
	case http.MethodPost:
		var req createBlockedIPRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}

		ip := strings.TrimSpace(req.IP)
		if parsed := net.ParseIP(ip); parsed == nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid ip")
			return
		}

		expiresAt, err := parseBlockedIPExpiry(req.ExpiresAt)
		if err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid expires_at")
			return
		}

		item, err := m.customers.CreateBlockedIP(r.Context(), storcustomers.CreateBlockedIPInput{
			IP:        ip,
			Reason:    req.Reason,
			ExpiresAt: expiresAt,
		})
		if err != nil {
			writeBlockedIPStoreError(w, err, "create blocked ip error")
			return
		}
		securitySeverity := "security"
		m.writeCustomerActionLog(r, customerActionIPBlocked, nil, &securitySeverity, map[string]any{
			"blocked_ip_id": item.ID,
			"ip":            item.IP,
			"reason":        item.Reason,
			"expires_at":    item.ExpiresAt,
		})
		_ = platformhttp.JSON(w, http.StatusCreated, item)
		return
	default:
		http.NotFound(w, r)
		return
	}
}

func (m *module) handleBlockedIPDetail(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/admin/security/blocked-ips/") {
		http.NotFound(w, r)
		return
	}
	if m.customers == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	if r.Method != http.MethodDelete {
		http.NotFound(w, r)
		return
	}

	id := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/admin/security/blocked-ips/"))
	if id == "" || strings.Contains(id, "/") {
		http.NotFound(w, r)
		return
	}

	item, err := m.customers.DeleteBlockedIP(r.Context(), id)
	if err != nil {
		writeBlockedIPStoreError(w, err, "delete blocked ip error")
		return
	}
	securitySeverity := "security"
	m.writeCustomerActionLog(r, customerActionIPUnblocked, nil, &securitySeverity, map[string]any{
		"blocked_ip_id": item.ID,
		"ip":            item.IP,
		"reason":        item.Reason,
	})
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"id": item.ID,
		"ip": item.IP,
	})
}

func parseBlockedIPExpiry(raw *string) (*time.Time, error) {
	if raw == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*raw)
	if trimmed == "" {
		return nil, nil
	}
	value, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func writeBlockedIPStoreError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, storcustomers.ErrNotFound):
		platformhttp.Error(w, http.StatusNotFound, "not found")
	case errors.Is(err, storcustomers.ErrConflict):
		platformhttp.Error(w, http.StatusConflict, "ip is already blocked")
	case errors.Is(err, storcustomers.ErrInvalid):
		platformhttp.Error(w, http.StatusBadRequest, "invalid blocked ip payload")
	default:
		platformhttp.Error(w, http.StatusInternalServerError, fallback)
	}
}
