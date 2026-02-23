package adminauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

type memSessionCache struct {
	mu   sync.RWMutex
	data map[string]string
}

func (m *memSessionCache) Set(_ context.Context, key string, value string, _ time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = value
	return nil
}

func (m *memSessionCache) Get(_ context.Context, key string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	v, ok := m.data[key]
	if !ok {
		return "", ErrSessionNotFound
	}
	return v, nil
}

func (m *memSessionCache) Del(_ context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.data, key)
	return nil
}

func TestSessionManagerCreateResolveDestroy(t *testing.T) {
	cache := &memSessionCache{data: map[string]string{}}
	manager := NewSessionManager(cache, 45*time.Minute)
	now := time.Unix(1700000000, 0).UTC()

	token, created, err := manager.Create(context.Background(), SessionUser{
		ID:          "u1",
		Email:       "admin@example.com",
		DisplayName: "Admin",
		Roles:       []string{"admin"},
	}, now)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if token == "" {
		t.Fatalf("expected token")
	}
	if created.User.Email != "admin@example.com" {
		t.Fatalf("unexpected user in created state")
	}

	state, err := manager.Resolve(context.Background(), token)
	if err != nil {
		t.Fatalf("resolve session: %v", err)
	}
	if state.User.ID != "u1" {
		t.Fatalf("unexpected user ID: %s", state.User.ID)
	}

	if err := manager.Destroy(context.Background(), token); err != nil {
		t.Fatalf("destroy session: %v", err)
	}
	if _, err := manager.Resolve(context.Background(), token); err == nil {
		t.Fatalf("expected resolve to fail after destroy")
	}
}

func TestSetAndClearSessionCookie(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/admin/auth/me", nil)
	rr := httptest.NewRecorder()
	setSessionCookie(rr, req, "token123", 45*time.Minute)
	clearSessionCookie(rr, req)

	cookies := rr.Result().Cookies()
	if len(cookies) < 2 {
		t.Fatalf("expected both set and clear cookies, got %d", len(cookies))
	}
	if cookies[0].Name != adminSessionCookieName || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode {
		t.Fatalf("unexpected session cookie attributes")
	}
	if cookies[1].Name != adminSessionCookieName || cookies[1].MaxAge != -1 {
		t.Fatalf("unexpected clear session cookie attributes")
	}
}
