package httpx

import (
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
	for _, cidr := range cidrs {
		cidr = strings.TrimSpace(cidr)
		if cidr == "" {
			continue
		}
		if !strings.Contains(cidr, "/") {
			if strings.Contains(cidr, ":") {
				cidr += "/128"
			} else {
				cidr += "/32"
			}
		}
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		nets = append(nets, ipNet)
	}
	trustedMu.Lock()
	trustedProxies = nets
	trustedMu.Unlock()
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
