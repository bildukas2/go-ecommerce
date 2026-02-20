package app

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	platformhttp "goecommerce/internal/platform/http"
	storcustomers "goecommerce/internal/storage/customers"
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
	uploadsDir := strings.TrimSpace(os.Getenv("UPLOADS_DIR"))
	if uploadsDir == "" {
		uploadsDir = "./tmp/uploads"
	}
	_ = os.MkdirAll(uploadsDir, 0o755)
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsDir))))
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

	rateLimiter := platformhttp.NewRateLimiter(deps.Redis, 120, time.Minute)
	var ipBlockChecker platformhttp.IPBlockChecker
	if deps.DB != nil {
		if customerStore, err := storcustomers.NewStore(context.Background(), deps.DB); err == nil {
			ipBlockChecker = customerStore
		}
	}
	wrapped := applyAdminMiddleware(mux, rateLimiter)
	wrapped = platformhttp.IPBlockMiddleware(wrapped, ipBlockChecker)
	wrapped = platformhttp.CORS(wrapped, platformhttp.ParseAllowedOrigins(os.Getenv("CORS_ALLOWED_ORIGINS")))
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
