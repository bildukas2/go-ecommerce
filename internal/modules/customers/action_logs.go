package customers

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strings"

	storcustomers "goecommerce/internal/storage/customers"
)

const (
	customerActionCreated  = "customer.created"
	customerActionUpdated  = "customer.updated"
	customerActionDisabled = "customer.disabled"
	customerActionEnabled  = "customer.enabled"
)

func (m *module) writeCustomerActionLog(r *http.Request, action string, customerID *string, severity *string, meta map[string]any) {
	if m.store == nil {
		return
	}
	logger, ok := m.store.(interface {
		InsertCustomerActionLog(ctx context.Context, in storcustomers.CreateCustomerActionLogInput) (storcustomers.CustomerActionLog, error)
	})
	if !ok {
		return
	}
	ip := requestIP(r)
	if ip == "" {
		ip = "unknown"
	}
	userAgent := strings.TrimSpace(r.UserAgent())
	var userAgentPtr *string
	if userAgent != "" {
		userAgentPtr = &userAgent
	}
	metaJSON := json.RawMessage(`{}`)
	if len(meta) > 0 {
		raw, err := json.Marshal(meta)
		if err != nil {
			return
		}
		metaJSON = raw
	}
	_, _ = logger.InsertCustomerActionLog(r.Context(), storcustomers.CreateCustomerActionLogInput{
		CustomerID: customerID,
		IP:         ip,
		UserAgent:  userAgentPtr,
		Action:     action,
		Severity:   severity,
		MetaJSON:   metaJSON,
	})
}

func requestIP(r *http.Request) string {
	if r == nil {
		return ""
	}
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		first := strings.TrimSpace(strings.Split(forwardedFor, ",")[0])
		if first != "" {
			return first
		}
	}
	if host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr)); err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}
