package app

import (
	"net/http"

	platformhttp "goecommerce/internal/platform/http"
)

type readyResp struct {
	DB    string `json:"db"`
	Redis string `json:"redis"`
}

func NewRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		_ = platformhttp.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		_ = platformhttp.JSON(w, http.StatusOK, readyResp{DB: "down", Redis: "down"})
	})
	registerEnabledModules(mux)
	return mux
}
