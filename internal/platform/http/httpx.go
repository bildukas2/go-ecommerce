package httpx

import (
	"encoding/json"
	"net/http"
)

func JSON(w http.ResponseWriter, status int, v any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(v)
}

func Error(w http.ResponseWriter, status int, message string) {
	type E struct {
		Error string `json:"error"`
	}
	_ = JSON(w, status, E{Error: message})
}
