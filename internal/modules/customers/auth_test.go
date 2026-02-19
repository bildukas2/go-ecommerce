package customers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	storcart "goecommerce/internal/storage/cart"
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

func (f *fakeCustomerStore) RevokeSessionsByCustomerID(context.Context, string) error {
	return errors.New("not implemented")
}

func (f *fakeCustomerStore) AddFavorite(context.Context, string, string) (bool, error) {
	return false, errors.New("not implemented")
}

func (f *fakeCustomerStore) RemoveFavorite(context.Context, string, string) error {
	return errors.New("not implemented")
}

func (f *fakeCustomerStore) ListFavorites(context.Context, string, int, int) (storcustomers.FavoritesPage, error) {
	return storcustomers.FavoritesPage{}, errors.New("not implemented")
}

func (f *fakeCustomerStore) ListOrdersByCustomer(context.Context, string, int, int) (storcustomers.OrdersPage, error) {
	return storcustomers.OrdersPage{}, errors.New("not implemented")
}

func (f *fakeCustomerStore) UpdatePasswordAndRevokeSessions(context.Context, string, string) error {
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
		customer, tokenHash, err := ResolveAuthenticatedCustomer(req.Context(), req, store)
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
		_, _, err := ResolveAuthenticatedCustomer(req.Context(), req, store)
		if !errors.Is(err, ErrUnauthenticated) {
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

type fakeLoginStore struct {
	customer storcustomers.Customer
}

func (f *fakeLoginStore) CreateCustomer(context.Context, string, string) (storcustomers.Customer, error) {
	return storcustomers.Customer{}, errors.New("not implemented")
}

func (f *fakeLoginStore) GetCustomerByEmail(context.Context, string) (storcustomers.Customer, error) {
	return f.customer, nil
}

func (f *fakeLoginStore) CreateSession(context.Context, string, string, time.Time) (storcustomers.Session, error) {
	return storcustomers.Session{ID: "sess_1"}, nil
}

func (f *fakeLoginStore) RevokeSessionByTokenHash(context.Context, string) error {
	return nil
}

func (f *fakeLoginStore) RevokeSessionsByCustomerID(context.Context, string) error {
	return nil
}

func (f *fakeLoginStore) AddFavorite(context.Context, string, string) (bool, error) {
	return false, errors.New("not implemented")
}

func (f *fakeLoginStore) RemoveFavorite(context.Context, string, string) error {
	return errors.New("not implemented")
}

func (f *fakeLoginStore) ListFavorites(context.Context, string, int, int) (storcustomers.FavoritesPage, error) {
	return storcustomers.FavoritesPage{}, errors.New("not implemented")
}

func (f *fakeLoginStore) ListOrdersByCustomer(context.Context, string, int, int) (storcustomers.OrdersPage, error) {
	return storcustomers.OrdersPage{}, errors.New("not implemented")
}

func (f *fakeLoginStore) UpdatePasswordAndRevokeSessions(context.Context, string, string) error {
	return errors.New("not implemented")
}

func (f *fakeLoginStore) GetCustomerBySessionTokenHash(context.Context, string) (storcustomers.Customer, error) {
	return storcustomers.Customer{}, storcustomers.ErrNotFound
}

type fakeCartResolver struct {
	cartID     string
	customerID string
	guestCart  string
}

func (f *fakeCartResolver) ResolveCustomerCart(_ context.Context, customerID, guestCartID string) (storcart.Cart, error) {
	f.customerID = customerID
	f.guestCart = guestCartID
	return storcart.Cart{ID: f.cartID}, nil
}

func TestHandleLoginMergesGuestCartAndSetsCanonicalCookie(t *testing.T) {
	passwordHash, err := hashPassword("supersecret")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	loginStore := &fakeLoginStore{
		customer: storcustomers.Customer{
			ID:           "cust_1",
			Email:        "user@example.com",
			PasswordHash: passwordHash,
			CreatedAt:    time.Unix(1700000000, 0).UTC(),
		},
	}
	cartStore := &fakeCartResolver{cartID: "customer-cart"}

	m := &module{store: loginStore, cartStore: cartStore, sessionTTL: defaultSessionTTL, now: time.Now}
	body, _ := json.Marshal(credentialsRequest{Email: "user@example.com", Password: "supersecret"})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "cart_id", Value: "guest-cart"})

	rr := httptest.NewRecorder()
	m.handleLogin(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if cartStore.customerID != "cust_1" {
		t.Fatalf("expected customer id cust_1, got %s", cartStore.customerID)
	}
	if cartStore.guestCart != "guest-cart" {
		t.Fatalf("expected guest cart guest-cart, got %s", cartStore.guestCart)
	}

	setCookies := rr.Result().Header.Values("Set-Cookie")
	foundCustomerSession := false
	foundCartCookie := false
	for _, raw := range setCookies {
		if strings.HasPrefix(raw, sessionCookieName+"=") {
			foundCustomerSession = true
		}
		if strings.HasPrefix(raw, "cart_id=customer-cart") {
			foundCartCookie = true
		}
	}
	if !foundCustomerSession {
		t.Fatalf("expected session cookie to be set")
	}
	if !foundCartCookie {
		t.Fatalf("expected canonical cart cookie to be set")
	}
}
