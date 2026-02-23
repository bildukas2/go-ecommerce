package httpx

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

const (
	csrfCookieName = "csrf_token"
	csrfHeaderName = "X-CSRF-Token"
	csrfTokenBytes = 16
)

// CSRFProtection implements the double-submit cookie pattern.
// On every response it ensures a csrf_token cookie exists. On state-changing
// requests (POST/PUT/PATCH/DELETE) it requires the X-CSRF-Token header to
// match the cookie value. Safe methods and preflight requests are exempt.
func CSRFProtection(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(csrfCookieName)
		if err != nil || cookie.Value == "" {
			token := generateCSRFToken()
			http.SetCookie(w, &http.Cookie{
				Name:     csrfCookieName,
				Value:    token,
				Path:     "/",
				HttpOnly: false, // JS must read this to send as header
				SameSite: http.SameSiteLaxMode,
				Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
			})
			cookie = &http.Cookie{Value: token}
		}

		if isSafeMethod(r.Method) {
			next.ServeHTTP(w, r)
			return
		}

		// Skip CSRF for requests with explicit Basic Auth (server-to-server calls)
		if _, _, ok := r.BasicAuth(); ok {
			next.ServeHTTP(w, r)
			return
		}

		headerToken := r.Header.Get(csrfHeaderName)
		if headerToken == "" || headerToken != cookie.Value {
			Error(w, http.StatusForbidden, "csrf token mismatch")
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isSafeMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	return false
}

func generateCSRFToken() string {
	b := make([]byte, csrfTokenBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
