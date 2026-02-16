package app

import (
	"context"
	"database/sql"
	"net/http"
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
	return mux
}
