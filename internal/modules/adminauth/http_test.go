package adminauth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	storadminauth "goecommerce/internal/storage/adminauth"
	"golang.org/x/crypto/bcrypt"
)

type fakeAdminAuthStore struct {
	userByEmail map[string]storadminauth.User
	rolesByUser map[string][]string
}

func (f *fakeAdminAuthStore) GetUserByEmail(_ context.Context, email string) (storadminauth.User, error) {
	if u, ok := f.userByEmail[email]; ok {
		return u, nil
	}
	return storadminauth.User{}, storadminauth.ErrNotFound
}

func (f *fakeAdminAuthStore) ListRoleCodesByUserID(_ context.Context, userID string) ([]string, error) {
	roles, ok := f.rolesByUser[userID]
	if !ok {
		return nil, nil
	}
	return roles, nil
}

func (f *fakeAdminAuthStore) UpdateLastLoginAt(_ context.Context, _ string, _ time.Time) error {
	return nil
}

func TestHandleCSRF(t *testing.T) {
	m := &module{}
	req := httptest.NewRequest(http.MethodGet, "/api/admin/auth/csrf", nil)
	rr := httptest.NewRecorder()

	m.handleCSRF(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if len(rr.Result().Cookies()) == 0 || rr.Result().Cookies()[0].Name != csrfCookieName {
		t.Fatalf("expected csrf cookie to be set")
	}
	var out map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if out["csrf_token"] == "" {
		t.Fatalf("expected csrf_token in response")
	}
}

func TestHandleLoginAndMeSuccess(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("StrongPass!123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	store := &fakeAdminAuthStore{
		userByEmail: map[string]storadminauth.User{
			"admin@example.com": {
				ID:           "user-1",
				Email:        "admin@example.com",
				PasswordHash: string(hash),
				DisplayName:  "Admin",
				IsActive:     true,
			},
		},
		rolesByUser: map[string][]string{
			"user-1": {"admin"},
		},
	}
	cache := &memSessionCache{data: map[string]string{}}
	m := &module{
		store:     store,
		sessions:  NewSessionManager(cache, 45*time.Minute),
		protect:   newTestLoginProtection(),
		sessionTT: 45 * time.Minute,
		now:       time.Now,
	}

	loginBody, _ := json.Marshal(loginRequest{
		Email:        "admin@example.com",
		Password:     "StrongPass!123",
		CaptchaToken: "test-captcha",
	})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	m.handleLogin(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", loginRec.Code)
	}
	var sessionCookie *http.Cookie
	for _, c := range loginRec.Result().Cookies() {
		if c.Name == adminSessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatalf("expected admin session cookie")
	}

	meReq := httptest.NewRequest(http.MethodGet, "/api/admin/auth/me", nil)
	meReq.AddCookie(sessionCookie)
	meRec := httptest.NewRecorder()
	m.handleMe(meRec, meReq)
	if meRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", meRec.Code)
	}
}

func TestHandleLoginInvalidCredentialsMessage(t *testing.T) {
	store := &fakeAdminAuthStore{
		userByEmail: map[string]storadminauth.User{},
		rolesByUser: map[string][]string{},
	}
	cache := &memSessionCache{data: map[string]string{}}
	m := &module{
		store:     store,
		sessions:  NewSessionManager(cache, 45*time.Minute),
		protect:   newTestLoginProtection(),
		sessionTT: 45 * time.Minute,
		now:       time.Now,
	}

	body, _ := json.Marshal(loginRequest{
		Email:        "missing@example.com",
		Password:     "StrongPass!123",
		CaptchaToken: "token",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	m.handleLogin(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
	var out authErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if out.Code != "invalid_credentials" || out.Error != "invalid email or password" {
		t.Fatalf("unexpected auth error response: %#v", out)
	}
}

func TestHandleLogout(t *testing.T) {
	cache := &memSessionCache{data: map[string]string{}}
	manager := NewSessionManager(cache, 45*time.Minute)
	token, _, err := manager.Create(context.Background(), SessionUser{
		ID:          "u1",
		Email:       "admin@example.com",
		DisplayName: "Admin",
		Roles:       []string{"admin"},
	}, time.Now())
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	m := &module{
		sessions:  manager,
		sessionTT: 45 * time.Minute,
		now:       time.Now,
	}
	req := httptest.NewRequest(http.MethodPost, "/api/admin/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: adminSessionCookieName, Value: token})
	rr := httptest.NewRecorder()
	m.handleLogout(rr, req)
	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rr.Code)
	}
	if _, err := manager.Resolve(req.Context(), token); !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("expected session to be removed")
	}
}

func TestHandleLoginCaptchaFailed(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("StrongPass!123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	store := &fakeAdminAuthStore{
		userByEmail: map[string]storadminauth.User{
			"admin@example.com": {
				ID:           "user-1",
				Email:        "admin@example.com",
				PasswordHash: string(hash),
				DisplayName:  "Admin",
				IsActive:     true,
			},
		},
		rolesByUser: map[string][]string{
			"user-1": {"admin"},
		},
	}
	cache := &memSessionCache{data: map[string]string{}}
	protect := newTestLoginProtection()
	protect.captchaVerifier = stubCaptchaVerifier{ok: false}
	m := &module{
		store:     store,
		sessions:  NewSessionManager(cache, 45*time.Minute),
		protect:   protect,
		sessionTT: 45 * time.Minute,
		now:       time.Now,
	}

	loginBody, _ := json.Marshal(loginRequest{
		Email:        "admin@example.com",
		Password:     "StrongPass!123",
		CaptchaToken: "bad-token",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", bytes.NewReader(loginBody))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	m.handleLogin(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
	var out authErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if out.Code != "captcha_failed" {
		t.Fatalf("expected captcha_failed, got %s", out.Code)
	}
}

func TestHandleLoginLockoutAfterFiveFailures(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("StrongPass!123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	store := &fakeAdminAuthStore{
		userByEmail: map[string]storadminauth.User{
			"admin@example.com": {
				ID:           "user-1",
				Email:        "admin@example.com",
				PasswordHash: string(hash),
				DisplayName:  "Admin",
				IsActive:     true,
			},
		},
		rolesByUser: map[string][]string{
			"user-1": {"admin"},
		},
	}
	cache := &memSessionCache{data: map[string]string{}}
	m := &module{
		store:     store,
		sessions:  NewSessionManager(cache, 45*time.Minute),
		protect:   newTestLoginProtection(),
		sessionTT: 45 * time.Minute,
		now:       time.Now,
	}

	for i := 1; i <= 5; i++ {
		loginBody, _ := json.Marshal(loginRequest{
			Email:        "admin@example.com",
			Password:     "WrongPass!123",
			CaptchaToken: "captcha-ok",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", bytes.NewReader(loginBody))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		m.handleLogin(rr, req)
		if i < 5 && rr.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d expected 401, got %d", i, rr.Code)
		}
		if i == 5 && rr.Code != http.StatusTooManyRequests {
			t.Fatalf("attempt %d expected 429, got %d", i, rr.Code)
		}
	}
}
