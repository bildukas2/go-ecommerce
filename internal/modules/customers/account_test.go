package customers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	storcustomers "goecommerce/internal/storage/customers"
)

type fakeAccountStore struct {
	customerByToken map[string]storcustomers.Customer
	favoritesByCust map[string][]storcustomers.Favorite
	ordersByCust    map[string][]storcustomers.OrderHistoryOrder
	createdFavs     map[string]map[string]struct{}
	lastFavCustID   string
	lastOrdCustID   string
	updateCalled    bool
}

func (f *fakeAccountStore) CreateCustomer(context.Context, string, string) (storcustomers.Customer, error) {
	return storcustomers.Customer{}, errors.New("not implemented")
}
func (f *fakeAccountStore) GetCustomerByEmail(context.Context, string) (storcustomers.Customer, error) {
	return storcustomers.Customer{}, errors.New("not implemented")
}
func (f *fakeAccountStore) CreateSession(context.Context, string, string, time.Time) (storcustomers.Session, error) {
	return storcustomers.Session{}, errors.New("not implemented")
}
func (f *fakeAccountStore) RevokeSessionByTokenHash(context.Context, string) error   { return nil }
func (f *fakeAccountStore) RevokeSessionsByCustomerID(context.Context, string) error { return nil }
func (f *fakeAccountStore) RemoveFavorite(context.Context, string, string) error     { return nil }

func (f *fakeAccountStore) AddFavorite(_ context.Context, customerID, productID string) (bool, error) {
	if f.createdFavs == nil {
		f.createdFavs = map[string]map[string]struct{}{}
	}
	if _, ok := f.createdFavs[customerID]; !ok {
		f.createdFavs[customerID] = map[string]struct{}{}
	}
	_, exists := f.createdFavs[customerID][productID]
	f.createdFavs[customerID][productID] = struct{}{}
	return !exists, nil
}

func (f *fakeAccountStore) ListFavorites(_ context.Context, customerID string, page, limit int) (storcustomers.FavoritesPage, error) {
	f.lastFavCustID = customerID
	items := f.favoritesByCust[customerID]
	return storcustomers.FavoritesPage{Items: items, Total: len(items), Page: page, Limit: limit}, nil
}

func (f *fakeAccountStore) ListOrdersByCustomer(_ context.Context, customerID string, page, limit int) (storcustomers.OrdersPage, error) {
	f.lastOrdCustID = customerID
	items := f.ordersByCust[customerID]
	return storcustomers.OrdersPage{Items: items, Total: len(items), Page: page, Limit: limit}, nil
}

func (f *fakeAccountStore) UpdatePasswordAndRevokeSessions(context.Context, string, string) error {
	f.updateCalled = true
	return nil
}

func (f *fakeAccountStore) GetCustomerBySessionTokenHash(_ context.Context, tokenHash string) (storcustomers.Customer, error) {
	if c, ok := f.customerByToken[tokenHash]; ok {
		return c, nil
	}
	return storcustomers.Customer{}, storcustomers.ErrNotFound
}

func TestAccountEndpointsRequireAuthentication(t *testing.T) {
	m := &module{
		store: &fakeAccountStore{},
		now:   time.Now,
	}
	tests := []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/account/favorites"},
		{method: http.MethodGet, path: "/account/orders"},
		{method: http.MethodPost, path: "/account/change-password"},
	}
	for _, tc := range tests {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		rr := httptest.NewRecorder()
		switch tc.path {
		case "/account/favorites":
			m.handleFavorites(rr, req)
		case "/account/orders":
			m.handleOrders(rr, req)
		default:
			m.handleChangePassword(rr, req)
		}
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s: expected 401, got %d", tc.method, tc.path, rr.Code)
		}
	}
}

func TestHandleFavoritesDuplicateSafeAndScoped(t *testing.T) {
	store := &fakeAccountStore{
		customerByToken: map[string]storcustomers.Customer{
			hashSessionToken("token-1"): {ID: "cust_1", Email: "c1@example.com"},
		},
		favoritesByCust: map[string][]storcustomers.Favorite{
			"cust_2": {{ProductID: "prod-2"}},
		},
	}
	m := &module{store: store, now: time.Now}

	body, _ := json.Marshal(map[string]string{"product_id": "prod-1"})
	req1 := httptest.NewRequest(http.MethodPost, "/account/favorites", bytes.NewReader(body))
	req1.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "token-1"})
	rr1 := httptest.NewRecorder()
	m.handleFavorites(rr1, req1)
	if rr1.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr1.Code)
	}

	req2 := httptest.NewRequest(http.MethodPost, "/account/favorites", bytes.NewReader(body))
	req2.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "token-1"})
	rr2 := httptest.NewRecorder()
	m.handleFavorites(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Fatalf("expected 200 for duplicate favorite, got %d", rr2.Code)
	}

	req3 := httptest.NewRequest(http.MethodGet, "/account/favorites?page=1&limit=5", nil)
	req3.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "token-1"})
	rr3 := httptest.NewRecorder()
	m.handleFavorites(rr3, req3)
	if rr3.Code != http.StatusOK {
		t.Fatalf("expected 200 list favorites, got %d", rr3.Code)
	}
	if store.lastFavCustID != "cust_1" {
		t.Fatalf("expected favorites scoped to cust_1, got %s", store.lastFavCustID)
	}
}

func TestHandleOrdersScopedToAuthenticatedCustomer(t *testing.T) {
	store := &fakeAccountStore{
		customerByToken: map[string]storcustomers.Customer{
			hashSessionToken("token-1"): {ID: "cust_1", Email: "c1@example.com"},
		},
		ordersByCust: map[string][]storcustomers.OrderHistoryOrder{
			"cust_2": {{ID: "ord-2"}},
		},
	}
	m := &module{store: store, now: time.Now}

	req := httptest.NewRequest(http.MethodGet, "/account/orders", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "token-1"})
	rr := httptest.NewRecorder()
	m.handleOrders(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if store.lastOrdCustID != "cust_1" {
		t.Fatalf("expected orders scoped to cust_1, got %s", store.lastOrdCustID)
	}
}

func TestHandleChangePasswordValidationAndSuccess(t *testing.T) {
	hash, err := hashPassword("current-pass")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	store := &fakeAccountStore{
		customerByToken: map[string]storcustomers.Customer{
			hashSessionToken("token-1"): {ID: "cust_1", Email: "c1@example.com", PasswordHash: hash},
		},
	}
	m := &module{store: store, now: time.Now}

	badBody, _ := json.Marshal(map[string]string{
		"current_password": "wrong-pass",
		"new_password":     "new-password",
	})
	badReq := httptest.NewRequest(http.MethodPost, "/account/change-password", bytes.NewReader(badBody))
	badReq.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "token-1"})
	badRes := httptest.NewRecorder()
	m.handleChangePassword(badRes, badReq)
	if badRes.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for wrong current password, got %d", badRes.Code)
	}
	if store.updateCalled {
		t.Fatalf("password update should not be called on wrong current password")
	}

	okBody, _ := json.Marshal(map[string]string{
		"current_password": "current-pass",
		"new_password":     "new-password",
	})
	okReq := httptest.NewRequest(http.MethodPost, "/account/change-password", bytes.NewReader(okBody))
	okReq.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "token-1"})
	okRes := httptest.NewRecorder()
	m.handleChangePassword(okRes, okReq)
	if okRes.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", okRes.Code)
	}
	if !store.updateCalled {
		t.Fatalf("expected password update call on success")
	}
}
