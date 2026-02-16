package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterFallbackMode(t *testing.T) {
	limiter := NewRateLimiter(nil, 5, time.Minute)

	handler := limiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	testIP := "192.168.1.100"

	for i := 1; i <= 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = testIP + ":12345"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, rec.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = testIP + ":12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("request 6: expected 429, got %d", rec.Code)
	}
}
