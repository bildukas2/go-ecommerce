package adminauth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type stubCaptchaVerifier struct {
	ok  bool
	err error
}

func (s stubCaptchaVerifier) Verify(_ context.Context, _ string, _ string) (bool, error) {
	return s.ok, s.err
}

func newTestLoginProtection() *loginProtection {
	p := newLoginProtection(nil, stubCaptchaVerifier{ok: true})
	p.sleep = func(time.Duration) {}
	p.randomIntn = func(int) int { return 0 }
	return p
}

func TestTurnstileVerifierFailsClosedWithoutSecret(t *testing.T) {
	verifier := &turnstileVerifier{
		client:   &http.Client{Timeout: time.Second},
		secret:   "",
		endpoint: defaultTurnstileVerifyURL,
	}
	ok, err := verifier.Verify(context.Background(), "token", "127.0.0.1")
	if ok {
		t.Fatalf("expected captcha verification to fail")
	}
	if !errors.Is(err, errCaptchaSecretMissing) {
		t.Fatalf("expected missing secret error, got %v", err)
	}
}

func TestTurnstileVerifierRejectsInvalidTokenResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"success":false}`))
	}))
	defer srv.Close()

	verifier := &turnstileVerifier{
		client:   srv.Client(),
		secret:   "secret",
		endpoint: srv.URL,
	}
	ok, err := verifier.Verify(context.Background(), "token", "127.0.0.1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Fatalf("expected invalid captcha result")
	}
}

func TestLoginProtectionEmailLockoutAfterFiveFailures(t *testing.T) {
	p := newTestLoginProtection()
	email := "admin@example.com"
	for i := 0; i < 4; i++ {
		locked, err := p.RegisterEmailFailure(context.Background(), email)
		if err != nil {
			t.Fatalf("register failure %d: %v", i+1, err)
		}
		if locked {
			t.Fatalf("expected unlocked before threshold")
		}
	}
	locked, err := p.RegisterEmailFailure(context.Background(), email)
	if err != nil {
		t.Fatalf("register failure 5: %v", err)
	}
	if !locked {
		t.Fatalf("expected lock at threshold")
	}
	isLocked, err := p.IsEmailLocked(context.Background(), email)
	if err != nil {
		t.Fatalf("is locked: %v", err)
	}
	if !isLocked {
		t.Fatalf("expected email to be locked")
	}
}

func TestLoginProtectionResetClearsFailuresAndLock(t *testing.T) {
	p := newTestLoginProtection()
	email := "admin@example.com"
	for i := 0; i < 5; i++ {
		_, _ = p.RegisterEmailFailure(context.Background(), email)
	}
	if err := p.ResetEmailFailures(context.Background(), email); err != nil {
		t.Fatalf("reset failures: %v", err)
	}
	isLocked, err := p.IsEmailLocked(context.Background(), email)
	if err != nil {
		t.Fatalf("is locked after reset: %v", err)
	}
	if isLocked {
		t.Fatalf("expected lock to be cleared")
	}
}

func TestLoginProtectionIPLimit(t *testing.T) {
	p := newTestLoginProtection()
	ip := "203.0.113.15"
	for i := 0; i < int(defaultLoginIPLimit); i++ {
		allowed, err := p.IsIPAllowed(context.Background(), ip)
		if err != nil {
			t.Fatalf("ip check %d: %v", i+1, err)
		}
		if !allowed {
			t.Fatalf("expected request %d to be allowed", i+1)
		}
	}
	allowed, err := p.IsIPAllowed(context.Background(), ip)
	if err != nil {
		t.Fatalf("ip check overflow: %v", err)
	}
	if allowed {
		t.Fatalf("expected overflow request to be blocked")
	}
}

func TestLoginProtectionFailureDelayRange(t *testing.T) {
	p := newTestLoginProtection()
	var slept time.Duration
	p.sleep = func(d time.Duration) { slept = d }
	p.randomIntn = func(n int) int { return n - 1 }
	p.SleepFailureDelay()
	if slept < defaultFailureDelayMin || slept > defaultFailureDelayMin+defaultFailureDelayJitter {
		t.Fatalf("unexpected failure delay %v", slept)
	}
}
