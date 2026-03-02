package adminauth

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"goecommerce/internal/app"
	storadminauth "goecommerce/internal/storage/adminauth"
)

const (
	defaultSessionTTLMinutes = 45
	minSessionTTLMinutes     = 30
	maxSessionTTLMinutes     = 60
)

type adminAuthStore interface {
	GetUserByEmail(ctx context.Context, email string) (storadminauth.User, error)
	ListRoleCodesByUserID(ctx context.Context, userID string) ([]string, error)
	UpdateLastLoginAt(ctx context.Context, userID string, at time.Time) error
}

type module struct {
	store     adminAuthStore
	sessions  *SessionManager
	protect   *loginProtection
	sessionTT time.Duration
	now       func() time.Time
}

func NewModule(deps app.Deps) app.Module {
	var store adminAuthStore
	if deps.DB != nil {
		if st, err := storadminauth.NewStore(context.Background(), deps.DB); err == nil {
			store = st
		} else {
			slog.Error("module init: failed to create store", "module", "adminauth", "store", "adminauth", "error", err)
		}
	}

	sessionTTL := parseSessionTTL(strings.TrimSpace(os.Getenv("ADMIN_SESSION_TTL_MINUTES")))
	return &module{
		store:     store,
		sessions:  NewSessionManager(newRedisSessionCache(deps.Redis), sessionTTL),
		protect:   newLoginProtection(deps.Redis, newTurnstileVerifierFromEnv()),
		sessionTT: sessionTTL,
		now:       time.Now,
	}
}

func (m *module) Name() string { return "adminauth" }

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/admin/auth/csrf", m.handleCSRF)
	mux.HandleFunc("/admin/auth/login", m.handleLogin)
	mux.HandleFunc("/admin/auth/logout", m.handleLogout)
	mux.HandleFunc("/admin/auth/me", m.handleMe)
}

func parseSessionTTL(raw string) time.Duration {
	if raw == "" {
		return defaultSessionTTLMinutes * time.Minute
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return defaultSessionTTLMinutes * time.Minute
	}
	if n < minSessionTTLMinutes {
		n = minSessionTTLMinutes
	}
	if n > maxSessionTTLMinutes {
		n = maxSessionTTLMinutes
	}
	return time.Duration(n) * time.Minute
}

func newRedisSessionCache(client *redis.Client) sessionCache {
	if client == nil {
		return nil
	}
	return &redisSessionCache{client: client}
}
