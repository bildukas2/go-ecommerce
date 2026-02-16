package orders

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"strings"

	"goecommerce/internal/app"
	platformhttp "goecommerce/internal/platform/http"
	"goecommerce/internal/platform/payments"
	storcart "goecommerce/internal/storage/cart"
	stororders "goecommerce/internal/storage/orders"
)

type module struct {
	cart   *storcart.Store
	orders *stororders.Store
	pay    payments.Provider
}

func NewModule(deps app.Deps) app.Module {
	var cst *storcart.Store
	var ost *stororders.Store
	if deps.DB != nil {
		if s, err := storcart.NewStore(context.Background(), deps.DB); err == nil {
			cst = s
		}
		if s, err := stororders.NewStore(context.Background(), deps.DB); err == nil {
			ost = s
		}
	}
	var p payments.Provider = payments.NewFromEnv()
	return &module{cart: cst, orders: ost, pay: p}
}

func (m *module) Close() error {
	if m.cart != nil {
		_ = m.cart.Close()
	}
	if m.orders != nil {
		_ = m.orders.Close()
	}
	return nil
}

func (m *module) Name() string { return "orders" }

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/checkout", m.handleCheckout)
}

func (m *module) handleCheckout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	if r.URL.Path != "/checkout" {
		http.NotFound(w, r)
		return
	}
	if m.cart == nil || m.orders == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	cartID, ok := readCartID(r)
	if !ok || strings.TrimSpace(cartID) == "" {
		platformhttp.Error(w, http.StatusBadRequest, "no cart")
		return
	}
	c, err := m.cart.GetCart(r.Context(), cartID)
	if err != nil {
		if err == sql.ErrNoRows {
			platformhttp.Error(w, http.StatusNotFound, "not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "get error")
		return
	}
	if len(c.Items) == 0 {
		platformhttp.Error(w, http.StatusBadRequest, "empty cart")
		return
	}
	o, err := m.orders.CreateFromCart(r.Context(), c)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "checkout error")
		return
	}
	_ = os.Getenv
	url, _ := m.pay.CreateCheckout(r.Context(), o.TotalCents, o.Currency, o.Number)
	out := map[string]any{
		"order_id":     o.ID,
		"checkout_url": url,
		"status":       o.Status,
	}
	_ = platformhttp.JSON(w, http.StatusOK, out)
}

func readCartID(r *http.Request) (string, bool) {
	c, err := r.Cookie("cart_id")
	if err != nil {
		return "", false
	}
	return strings.TrimSpace(c.Value), true
}
