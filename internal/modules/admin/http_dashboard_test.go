package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	platformversion "goecommerce/internal/platform/version"
	stororders "goecommerce/internal/storage/orders"
)

func TestDashboardIncludesVersionFields(t *testing.T) {
	store := &fakeOrdersStore{
		getMetricsFn: func(context.Context) (stororders.OrderMetrics, error) {
			return stororders.OrderMetrics{}, nil
		},
		listOrdersFn: func(context.Context, int, int) ([]stororders.Order, error) {
			return []stororders.Order{
				{
					ID:         "o_1",
					Number:     "ORD-0001",
					Status:     "paid",
					TotalCents: 1000,
					Currency:   "USD",
					CreatedAt:  time.Now().UTC(),
				},
			}, nil
		},
		getWeeklyRevenueTrendFn: func(context.Context) ([]stororders.DashboardTrendPoint, error) {
			return []stororders.DashboardTrendPoint{}, nil
		},
		getTopProductsFn: func(context.Context, int) ([]stororders.DashboardTopProduct, error) {
			return []stororders.DashboardTopProduct{}, nil
		},
	}
	m := &module{orders: store}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["backend_version"] != platformversion.BackendVersion {
		t.Fatalf("expected backend_version %q, got %#v", platformversion.BackendVersion, payload["backend_version"])
	}
	if payload["web_version"] != platformversion.WebVersion {
		t.Fatalf("expected web_version %q, got %#v", platformversion.WebVersion, payload["web_version"])
	}
}
