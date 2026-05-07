package adminauth

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	platformhttp "goecommerce/internal/platform/http"
	storcustomers "goecommerce/internal/storage/customers"
)

const adminLoginFailedAction = "admin.login_failed"

func (m *module) writeLoginFailureLog(r *http.Request, email string, reason string) {
	if m == nil || r == nil {
		return
	}

	ip := platformhttp.ClientIP(r)
	if ip == "" {
		ip = "unknown"
	}
	userAgent := strings.TrimSpace(r.UserAgent())
	var userAgentPtr *string
	if userAgent != "" {
		userAgentPtr = &userAgent
	}

	meta := loginFailureMeta(r, email, reason)
	raw, err := json.Marshal(meta)
	if err != nil {
		raw = []byte(`{"reason":"login_failed"}`)
	}
	m.appendLoginFailureFile(ip, userAgent, raw)
	if m.auditStore == nil {
		return
	}
	severity := "security"
	_, _ = m.auditStore.InsertCustomerActionLog(r.Context(), storcustomers.CreateCustomerActionLogInput{
		IP:        ip,
		UserAgent: userAgentPtr,
		Action:    adminLoginFailedAction,
		Severity:  &severity,
		MetaJSON:  json.RawMessage(raw),
	})
}

func (m *module) appendLoginFailureFile(ip string, userAgent string, meta json.RawMessage) {
	path := strings.TrimSpace(m.loginFailureLogPath)
	if path == "" {
		return
	}
	entry := map[string]any{
		"ts":         time.Now().UTC().Format(time.RFC3339),
		"action":     adminLoginFailedAction,
		"severity":   "security",
		"ip":         strings.TrimSpace(ip),
		"user_agent": strings.TrimSpace(userAgent),
		"meta":       json.RawMessage(meta),
	}
	raw, err := json.Marshal(entry)
	if err != nil {
		return
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.Write(append(raw, '\n'))
}

func loginFailureMeta(r *http.Request, email string, reason string) map[string]any {
	isBot, signals := detectBotSignals(r)
	return map[string]any{
		"email":              strings.ToLower(strings.TrimSpace(email)),
		"reason":             strings.TrimSpace(reason),
		"path":               r.URL.Path,
		"method":             r.Method,
		"is_bot":             isBot,
		"bot_signals":        signals,
		"remote_addr":        truncateMetaValue(r.RemoteAddr, 120),
		"x_forwarded_for":    headerMetaValue(r, "X-Forwarded-For"),
		"cf_connecting_ip":   headerMetaValue(r, "CF-Connecting-IP"),
		"cf_ip_country":      headerMetaValue(r, "CF-IPCountry"),
		"cf_ray":             headerMetaValue(r, "CF-Ray"),
		"accept_language":    headerMetaValue(r, "Accept-Language"),
		"sec_ch_ua":          headerMetaValue(r, "Sec-CH-UA"),
		"sec_ch_ua_mobile":   headerMetaValue(r, "Sec-CH-UA-Mobile"),
		"sec_ch_ua_platform": headerMetaValue(r, "Sec-CH-UA-Platform"),
		"referer":            safeReferer(r),
	}
}

func detectBotSignals(r *http.Request) (bool, []string) {
	if r == nil {
		return false, nil
	}
	signals := make([]string, 0, 4)
	ua := strings.ToLower(strings.TrimSpace(r.UserAgent()))
	if ua == "" {
		signals = append(signals, "missing_user_agent")
	}

	for _, token := range []string{
		"bot", "crawler", "spider", "scanner", "curl", "wget",
		"python-requests", "httpclient", "scrapy", "headless",
		"phantom", "selenium", "playwright",
	} {
		if strings.Contains(ua, token) {
			signals = append(signals, "user_agent:"+token)
			break
		}
	}
	if strings.TrimSpace(r.Header.Get("Accept-Language")) == "" {
		signals = append(signals, "missing_accept_language")
	}
	if strings.TrimSpace(r.Header.Get("Sec-CH-UA")) == "" {
		signals = append(signals, "missing_client_hints")
	}
	return len(signals) > 0, signals
}

func safeReferer(r *http.Request) string {
	if r == nil {
		return ""
	}
	return truncateMetaValue(r.Referer(), 300)
}

func headerMetaValue(r *http.Request, name string) string {
	if r == nil {
		return ""
	}
	return truncateMetaValue(r.Header.Get(name), 300)
}

func truncateMetaValue(value string, max int) string {
	value = strings.TrimSpace(value)
	if max > 0 && len(value) > max {
		return value[:max]
	}
	return value
}
