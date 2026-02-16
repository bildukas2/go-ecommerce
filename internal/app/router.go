package app

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	platformhttp "goecommerce/internal/platform/http"
)

type readyResp struct {
	DB    string `json:"db"`
	Redis string `json:"redis"`
}

type Deps struct {
	DB    *sql.DB
	Redis *redis.Client
}

func NewRouter(deps Deps) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		_ = platformhttp.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		resp := readyResp{DB: "down", Redis: "down"}
		if deps.DB != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 500*time.Millisecond)
			if err := deps.DB.PingContext(ctx); err == nil {
				resp.DB = "ok"
			}
			cancel()
		}
		if deps.Redis != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 500*time.Millisecond)
			if err := deps.Redis.Ping(ctx).Err(); err == nil {
				resp.Redis = "ok"
			}
			cancel()
		}
		_ = platformhttp.JSON(w, http.StatusOK, resp)
	})
	registerEnabledModules(mux)

	rateLimiter := platformhttp.NewRateLimiter(deps.Redis, 30, time.Minute)
	wrapped := applyAdminMiddleware(mux, rateLimiter)
	return wrapped
}

func applyAdminMiddleware(mux *http.ServeMux, rateLimiter *platformhttp.RateLimiter) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/admin") {
			handler := platformhttp.SecurityHeaders(rateLimiter.Middleware(mux))
			handler.ServeHTTP(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	})
}
