package admin

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"strconv"
	"strings"

	"goecommerce/internal/app"
	platformhttp "goecommerce/internal/platform/http"
	stororders "goecommerce/internal/storage/orders"
)

type module struct {
	orders *stororders.Store
	user   string
	pass   string
}

func NewModule(deps app.Deps) app.Module {
	var ost *stororders.Store
	if deps.DB != nil {
		if s, err := stororders.NewStore(context.Background(), deps.DB); err == nil {
			ost = s
		}
	}
	return &module{orders: ost, user: strings.TrimSpace(os.Getenv("ADMIN_USER")), pass: strings.TrimSpace(os.Getenv("ADMIN_PASS"))}
}

func (m *module) Close() error {
	if m.orders != nil {
		_ = m.orders.Close()
	}
	return nil
}

func (m *module) Name() string { return "admin" }

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/admin/dashboard", m.wrapAuth(m.handleDashboard))
	mux.HandleFunc("/admin/orders", m.wrapAuth(m.handleOrders))
	mux.HandleFunc("/admin/orders/", m.wrapAuth(m.handleOrderDetail))
}

func (m *module) wrapAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m.user == "" || m.pass == "" {
			platformhttp.Error(w, http.StatusServiceUnavailable, "admin disabled")
			return
		}
		u, p, ok := r.BasicAuth()
		if !ok || u != m.user || p != m.pass {
			w.Header().Set("WWW-Authenticate", "Basic realm=admin")
			platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r)
	}
}

func (m *module) handleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if m.orders == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	metrics, err := m.orders.GetOrderMetrics(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "metrics error")
		return
	}

	recent, err := m.orders.ListOrders(r.Context(), 10, 0)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "recent orders error")
		return
	}

	recentOut := make([]map[string]any, 0, len(recent))
	for _, o := range recent {
		recentOut = append(recentOut, map[string]any{
			"id":          o.ID,
			"number":      o.Number,
			"status":      o.Status,
			"total_cents": o.TotalCents,
			"currency":    o.Currency,
			"created_at":  o.CreatedAt,
		})
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"metrics":       metrics,
		"recent_orders": recentOut,
	})
}

func (m *module) handleOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if r.URL.Path != "/admin/orders" {
		http.NotFound(w, r)
		return
	}
	if m.orders == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	qp := r.URL.Query()
	page := atoiDefault(qp.Get("page"), 1)
	limit := atoiDefault(qp.Get("limit"), 20)
	offset := (page - 1) * limit
	items, err := m.orders.ListOrders(r.Context(), limit, offset)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list error")
		return
	}
	outItems := make([]map[string]any, 0, len(items))
	for _, o := range items {
		outItems = append(outItems, map[string]any{
			"id":          o.ID,
			"number":      o.Number,
			"status":      o.Status,
			"currency":    o.Currency,
			"total_cents": o.TotalCents,
			"created_at":  o.CreatedAt,
		})
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"items": outItems,
		"page":  page,
		"limit": limit,
	})
}

func (m *module) handleOrderDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if !strings.HasPrefix(r.URL.Path, "/admin/orders/") {
		http.NotFound(w, r)
		return
	}
	id := r.URL.Path[len("/admin/orders/"):]
	if i := strings.IndexByte(id, '/'); i >= 0 {
		id = id[:i]
	}
	id = strings.TrimSpace(id)
	if id == "" {
		http.NotFound(w, r)
		return
	}
	if m.orders == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	o, err := m.orders.GetOrderByID(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			platformhttp.Error(w, http.StatusNotFound, "not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "get error")
		return
	}
	// Return the raw order struct; frontend admin can render fields and items
	_ = platformhttp.JSON(w, http.StatusOK, o)
}

func atoiDefault(s string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || n == 0 {
		return def
	}
	return n
}
