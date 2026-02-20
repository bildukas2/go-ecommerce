package admin

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"

	platformhttp "goecommerce/internal/platform/http"
	storcustomers "goecommerce/internal/storage/customers"
)

const (
	customerActionCreated      = "customer.created"
	customerActionUpdated      = "customer.updated"
	customerActionDisabled     = "customer.disabled"
	customerActionEnabled      = "customer.enabled"
	customerActionGroupChanged = "customer.group_changed"
	customerActionIPBlocked    = "ip.blocked"
	customerActionIPUnblocked  = "ip.unblocked"
	customerActionBlockedIssue = "blocked.report_submitted"
)

func (m *module) handleCustomerActionLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || r.URL.Path != "/admin/customers/logs" {
		http.NotFound(w, r)
		return
	}
	if m.customers == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	qp := r.URL.Query()
	page := atoiDefault(qp.Get("page"), 1)
	limit := atoiDefault(qp.Get("limit"), 20)
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	from, err := parseLogDate(qp.Get("from"), false)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid from date")
		return
	}
	to, err := parseLogDate(qp.Get("to"), true)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid to date")
		return
	}

	result, err := m.customers.ListCustomerActionLogs(r.Context(), storcustomers.ListCustomerActionLogsParams{
		Page:   page,
		Limit:  limit,
		Query:  strings.TrimSpace(qp.Get("q")),
		Action: strings.TrimSpace(qp.Get("action")),
		From:   from,
		To:     to,
	})
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list customer action logs error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, result)
}

func (m *module) writeCustomerActionLog(r *http.Request, action string, customerID *string, severity *string, meta map[string]any) {
	if m.customers == nil {
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
	metaJSON, err := marshalMetaJSON(meta)
	if err != nil {
		return
	}
	_, _ = m.customers.InsertCustomerActionLog(r.Context(), storcustomers.CreateCustomerActionLogInput{
		CustomerID: customerID,
		IP:         ip,
		UserAgent:  userAgentPtr,
		Action:     action,
		Severity:   severity,
		MetaJSON:   metaJSON,
	})
}

func parseLogDate(raw string, endOfDay bool) (*time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}

	if t, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return &t, nil
	}
	t, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return nil, err
	}
	if endOfDay {
		t = t.Add(24*time.Hour - time.Nanosecond)
	}
	return &t, nil
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

func marshalMetaJSON(meta map[string]any) (json.RawMessage, error) {
	if len(meta) == 0 {
		return json.RawMessage(`{}`), nil
	}
	raw, err := json.Marshal(meta)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(raw), nil
}
