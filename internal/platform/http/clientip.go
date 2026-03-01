package httpx

import (
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
)

var (
	trustedProxies []*net.IPNet
	trustedMu      sync.RWMutex
)

// SetTrustedProxies configures which proxy IPs/CIDRs are allowed to set
// X-Forwarded-For. Call once at startup. If empty, X-Forwarded-For is never
// trusted and RemoteAddr is always used.
func SetTrustedProxies(cidrs []string) {
	var nets []*net.IPNet
	for _, raw := range cidrs {
		// Handle potential multiple IPs/CIDRs in a single string if separated by spaces, commas, or semicolons
		f := func(c rune) bool {
			return c == ' ' || c == ',' || c == ';'
		}
		parts := strings.FieldsFunc(raw, f)

		for _, cidr := range parts {
			cidr = strings.TrimSpace(cidr)
			if cidr == "" {
				continue
			}

			// Special case: some users might use / as a separator if they think it's a list (like in the bug report)
			// e.g. ::1/78.56.202.79 (not a valid CIDR but contains /)
			// We first try to process it as is.
			if !isValidCIDR(cidr) && strings.Contains(cidr, "/") {
				subParts := strings.Split(cidr, "/")
				for _, sub := range subParts {
					processCIDR(&nets, sub)
				}
				continue
			}

			processCIDR(&nets, cidr)
		}
	}
	trustedMu.Lock()
	trustedProxies = nets
	trustedMu.Unlock()
}

func isValidCIDR(cidr string) bool {
	if !strings.Contains(cidr, "/") {
		return false
	}
	_, _, err := net.ParseCIDR(cidr)
	return err == nil
}

func processCIDR(nets *[]*net.IPNet, cidr string) {
	cidr = strings.TrimSpace(cidr)
	if cidr == "" {
		return
	}
	original := cidr
	if !strings.Contains(cidr, "/") {
		if strings.Contains(cidr, ":") {
			cidr += "/128"
		} else {
			cidr += "/32"
		}
	}
	_, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		slog.Warn("SetTrustedProxies: invalid CIDR or IP", "input", original, "error", err)
		return
	}
	*nets = append(*nets, ipNet)
}

// ClientIP extracts the real client IP from the request. It only trusts
// X-Forwarded-For when RemoteAddr belongs to a configured trusted proxy.
func ClientIP(r *http.Request) string {
	if r == nil {
		return ""
	}

	remoteIP := stripIPPort(r.RemoteAddr)

	if isTrustedProxy(remoteIP) {
		xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
		if xff != "" {
			parts := strings.Split(xff, ",")
			if first := strings.TrimSpace(parts[0]); first != "" {
				return stripIPPort(first)
			}
		}
	}

	return remoteIP
}

func isTrustedProxy(ip string) bool {
	trustedMu.RLock()
	proxies := trustedProxies
	trustedMu.RUnlock()

	if len(proxies) == 0 {
		return false
	}
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}
	for _, n := range proxies {
		if n.Contains(parsed) {
			return true
		}
	}
	return false
}

func stripIPPort(addr string) string {
	if addr == "" {
		return ""
	}
	host, _, err := net.SplitHostPort(addr)
	if err == nil && host != "" {
		return host
	}
	return addr
}
