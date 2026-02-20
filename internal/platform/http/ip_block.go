package httpx

import (
	"context"
	"net"
	"net/http"
	"strings"
)

type IPBlockChecker interface {
	IsIPBlocked(ctx context.Context, ip string) (bool, error)
}

func IPBlockMiddleware(next http.Handler, checker IPBlockChecker) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if checker == nil || r == nil {
			next.ServeHTTP(w, r)
			return
		}
		if !isWriteMethod(r.Method) || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		if strings.EqualFold(r.URL.Path, "/support/blocked-report") {
			next.ServeHTTP(w, r)
			return
		}

		ip := requestIPFromHTTP(r)
		if ip == "" {
			ip = "unknown"
		}
		blocked, err := checker.IsIPBlocked(r.Context(), ip)
		if err != nil {
			Error(w, http.StatusInternalServerError, "ip block check error")
			return
		}
		if !blocked {
			next.ServeHTTP(w, r)
			return
		}

		w.Header().Set("X-Blocked-Redirect", "/blocked")
		_ = JSON(w, http.StatusForbidden, map[string]any{
			"error":       "ip blocked",
			"redirect_to": "/blocked",
		})
	})
}

func isWriteMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func requestIPFromHTTP(r *http.Request) string {
	if r == nil {
		return ""
	}
	forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		if len(parts) > 0 {
			first := strings.TrimSpace(parts[0])
			if first != "" {
				return stripPortFromIP(first)
			}
		}
	}
	return stripPortFromIP(strings.TrimSpace(r.RemoteAddr))
}

func stripPortFromIP(raw string) string {
	if raw == "" {
		return ""
	}
	host, _, err := net.SplitHostPort(raw)
	if err == nil && host != "" {
		return host
	}
	return raw
}
