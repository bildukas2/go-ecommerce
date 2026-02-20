package httpx

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeIPBlockChecker struct {
	isBlockedFn func(context.Context, string) (bool, error)
}

func (f *fakeIPBlockChecker) IsIPBlocked(ctx context.Context, ip string) (bool, error) {
	if f.isBlockedFn == nil {
		return false, nil
	}
	return f.isBlockedFn(ctx, ip)
}

func TestIPBlockMiddlewareAllowsReadRequests(t *testing.T) {
	called := false
	handler := IPBlockMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}), &fakeIPBlockChecker{
		isBlockedFn: func(_ context.Context, _ string) (bool, error) {
			t.Fatalf("checker should not run for read methods")
			return false, nil
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if !called {
		t.Fatalf("expected next handler call")
	}
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}

func TestIPBlockMiddlewareBlocksWriteRequest(t *testing.T) {
	handler := IPBlockMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("next handler should not run for blocked IP")
	}), &fakeIPBlockChecker{
		isBlockedFn: func(_ context.Context, ip string) (bool, error) {
			if ip != "203.0.113.7" {
				t.Fatalf("unexpected ip %q", ip)
			}
			return true, nil
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/cart/items", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.7")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", res.Code)
	}
	if got := res.Header().Get("X-Blocked-Redirect"); got != "/blocked" {
		t.Fatalf("expected blocked redirect header, got %q", got)
	}
}

func TestIPBlockMiddlewareAllowsExpiredOrUnblockedIP(t *testing.T) {
	called := false
	handler := IPBlockMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusCreated)
	}), &fakeIPBlockChecker{
		isBlockedFn: func(_ context.Context, _ string) (bool, error) {
			return false, nil
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/checkout", nil)
	req.RemoteAddr = "127.0.0.1:12345"
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if !called {
		t.Fatalf("expected next handler call")
	}
	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", res.Code)
	}
}

func TestIPBlockMiddlewareSkipsBlockedReportEndpoint(t *testing.T) {
	called := false
	handler := IPBlockMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusCreated)
	}), &fakeIPBlockChecker{
		isBlockedFn: func(_ context.Context, _ string) (bool, error) {
			t.Fatalf("checker should not run for blocked-report endpoint")
			return false, nil
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/support/blocked-report", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if !called {
		t.Fatalf("expected next handler call")
	}
}

func TestIPBlockMiddlewareHandlesCheckerError(t *testing.T) {
	handler := IPBlockMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("next handler should not be called on checker error")
	}), &fakeIPBlockChecker{
		isBlockedFn: func(_ context.Context, _ string) (bool, error) {
			return false, errors.New("boom")
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/cart/items", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", res.Code)
	}
}
