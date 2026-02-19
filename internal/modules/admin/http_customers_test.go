package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	storcustomers "goecommerce/internal/storage/customers"
)

type fakeCustomersStore struct {
	listCustomersFn func(context.Context, int, int) ([]storcustomers.AdminCustomer, error)
}

func (f *fakeCustomersStore) ListCustomers(ctx context.Context, limit, offset int) ([]storcustomers.AdminCustomer, error) {
	if f.listCustomersFn == nil {
		return []storcustomers.AdminCustomer{}, nil
	}
	return f.listCustomersFn(ctx, limit, offset)
}

func TestAdminCustomersListSuccess(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	store := &fakeCustomersStore{
		listCustomersFn: func(_ context.Context, limit, offset int) ([]storcustomers.AdminCustomer, error) {
			if limit != 10 || offset != 20 {
				t.Fatalf("unexpected pagination: limit=%d offset=%d", limit, offset)
			}
			return []storcustomers.AdminCustomer{
				{
					ID:        "cust-1",
					Email:     "customer@example.com",
					CreatedAt: now,
					UpdatedAt: now,
				},
			}, nil
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/customers?page=3&limit=10", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload struct {
		Items []map[string]any `json:"items"`
		Page  int              `json:"page"`
		Limit int              `json:"limit"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload.Page != 3 || payload.Limit != 10 {
		t.Fatalf("unexpected pagination response: %#v", payload)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one customer, got %d", len(payload.Items))
	}
	if payload.Items[0]["email"] != "customer@example.com" {
		t.Fatalf("unexpected customer payload: %#v", payload.Items[0])
	}
}

func TestAdminCustomersUnavailableWithoutStore(t *testing.T) {
	m := &module{user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/customers", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)

	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, res.Code)
	}
}
