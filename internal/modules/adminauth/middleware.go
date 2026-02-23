package adminauth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
)

type sessionUserContextKey struct{}

// SessionUserFromContext returns the authenticated admin user from request context.
func SessionUserFromContext(ctx context.Context) (SessionUser, bool) {
	if ctx == nil {
		return SessionUser{}, false
	}
	user, ok := ctx.Value(sessionUserContextKey{}).(SessionUser)
	return user, ok
}

func (m *module) RequireAdminSession() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}
			if isPublicAdminAuthRoute(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}
			if m.sessions == nil || !m.sessions.Available() {
				platformhttp.Error(w, http.StatusServiceUnavailable, "auth unavailable")
				return
			}

			token, err := resolveSessionTokenFromRequest(r)
			if err != nil {
				m.respondUnauthenticated(w, r)
				return
			}

			state, err := m.sessions.Resolve(r.Context(), token)
			if err != nil {
				if errors.Is(err, ErrSessionNotFound) {
					m.respondUnauthenticated(w, r)
					return
				}
				platformhttp.Error(w, http.StatusInternalServerError, "auth error")
				return
			}

			ctx := context.WithValue(r.Context(), sessionUserContextKey{}, state.User)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func (m *module) RequireRole(roleCode string) func(http.Handler) http.Handler {
	required := strings.ToLower(strings.TrimSpace(roleCode))
	return func(next http.Handler) http.Handler {
		base := m.RequireAdminSession()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions || isPublicAdminAuthRoute(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}
			user, ok := SessionUserFromContext(r.Context())
			if !ok || !hasRole(user.Roles, required) {
				platformhttp.Error(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		}))
		return base
	}
}

func isPublicAdminAuthRoute(path string) bool {
	return path == "/api/admin/auth/csrf" || path == "/api/admin/auth/login"
}

func (m *module) respondUnauthenticated(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/admin" {
		http.Redirect(w, r, "/admin/login", http.StatusFound)
		return
	}
	platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
}
