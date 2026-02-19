package customers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	storcustomers "goecommerce/internal/storage/customers"
)

type fakeCustomerStore struct {
	customerByToken map[string]storcustomers.Customer
}

func (f *fakeCustomerStore) CreateCustomer(context.Context, string, string) (storcustomers.Customer, error) {
	return storcustomers.Customer{}, errors.New("not implemented")
}

func (f *fakeCustomerStore) GetCustomerByEmail(context.Context, string) (storcustomers.Customer, error) {
	return storcustomers.Customer{}, errors.New("not implemented")
}

func (f *fakeCustomerStore) CreateSession(context.Context, string, string, time.Time) (storcustomers.Session, error) {
	return storcustomers.Session{}, errors.New("not implemented")
}

func (f *fakeCustomerStore) RevokeSessionByTokenHash(context.Context, string) error {
	return errors.New("not implemented")
}

func (f *fakeCustomerStore) GetCustomerBySessionTokenHash(_ context.Context, tokenHash string) (storcustomers.Customer, error) {
	if c, ok := f.customerByToken[tokenHash]; ok {
		return c, nil
	}
	return storcustomers.Customer{}, storcustomers.ErrNotFound
}

func TestHashPasswordAndVerify(t *testing.T) {
	hash, err := hashPassword("supersecret")
	if err != nil {
		t.Fatalf("hashPassword error: %v", err)
	}
	if hash == "" {
		t.Fatalf("expected non-empty hash")
	}
	if hash == "supersecret" {
		t.Fatalf("password should be hashed")
	}
	if !verifyPassword(hash, "supersecret") {
		t.Fatalf("expected valid password to verify")
	}
	if verifyPassword(hash, "wrong") {
		t.Fatalf("expected invalid password to fail")
	}
}

func TestResolveAuthenticatedCustomer(t *testing.T) {
	store := &fakeCustomerStore{
		customerByToken: map[string]storcustomers.Customer{
			hashSessionToken("valid-token"): {ID: "cust_1", Email: "user@example.com"},
		},
	}

	t.Run("success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "valid-token"})
		customer, tokenHash, err := resolveAuthenticatedCustomer(req.Context(), req, store)
		if err != nil {
			t.Fatalf("resolveAuthenticatedCustomer error: %v", err)
		}
		if customer.ID != "cust_1" {
			t.Fatalf("unexpected customer id: %s", customer.ID)
		}
		if tokenHash != hashSessionToken("valid-token") {
			t.Fatalf("unexpected token hash")
		}
	})

	t.Run("missing cookie", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
		_, _, err := resolveAuthenticatedCustomer(req.Context(), req, store)
		if !errors.Is(err, errUnauthenticated) {
			t.Fatalf("expected unauthenticated error, got: %v", err)
		}
	})
}

func TestHandleMeAuthBehavior(t *testing.T) {
	store := &fakeCustomerStore{
		customerByToken: map[string]storcustomers.Customer{
			hashSessionToken("valid-token"): {
				ID:        "cust_1",
				Email:     "user@example.com",
				CreatedAt: time.Unix(1700000000, 0).UTC(),
			},
		},
	}
	m := &module{store: store, sessionTTL: defaultSessionTTL, now: time.Now}

	t.Run("unauthorized without session", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
		rr := httptest.NewRecorder()
		m.handleMe(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", rr.Code)
		}
	})

	t.Run("authorized with valid session", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "valid-token"})
		rr := httptest.NewRecorder()
		m.handleMe(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rr.Code)
		}
	})
}
