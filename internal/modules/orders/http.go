package orders

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"os"
	"strings"

	"goecommerce/internal/app"
	modcustomers "goecommerce/internal/modules/customers"
	platformhttp "goecommerce/internal/platform/http"
	"goecommerce/internal/platform/payments"
	storcart "goecommerce/internal/storage/cart"
	storcustomers "goecommerce/internal/storage/customers"
	stororders "goecommerce/internal/storage/orders"
)

type module struct {
	cart      *storcart.Store
	customers *storcustomers.Store
	orders    *stororders.Store
	pay       payments.Provider
}

func NewModule(deps app.Deps) app.Module {
	var cst *storcart.Store
	var cust *storcustomers.Store
	var ost *stororders.Store
	if deps.DB != nil {
		if s, err := storcart.NewStore(context.Background(), deps.DB); err == nil {
			cst = s
		}
		if s, err := storcustomers.NewStore(context.Background(), deps.DB); err == nil {
			cust = s
		}
		if s, err := stororders.NewStore(context.Background(), deps.DB); err == nil {
			ost = s
		}
	}
	var p payments.Provider = payments.NewFromEnv()
	return &module{cart: cst, customers: cust, orders: ost, pay: p}
}

func (m *module) Close() error {
	if m.cart != nil {
		_ = m.cart.Close()
	}
	if m.orders != nil {
		_ = m.orders.Close()
	}
	if m.customers != nil {
		_ = m.customers.Close()
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
	customerID, authenticated, err := m.resolveCustomerID(r)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}

	var c storcart.Cart
	if authenticated {
		c, err = m.cart.ResolveCustomerCart(r.Context(), customerID, cartID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "get error")
			return
		}
		setCartCookie(w, r, c.ID)
	} else {
		if !ok || strings.TrimSpace(cartID) == "" {
			platformhttp.Error(w, http.StatusBadRequest, "no cart")
			return
		}
		c, err = m.cart.GetCart(r.Context(), cartID)
		if err != nil {
			if err == sql.ErrNoRows {
				platformhttp.Error(w, http.StatusNotFound, "not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "get error")
			return
		}
	}
	if len(c.Items) == 0 {
		platformhttp.Error(w, http.StatusBadRequest, "empty cart")
		return
	}
	if authenticated {
		o, err := m.orders.CreateFromCartForCustomer(r.Context(), c, customerID)
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

func setCartCookie(w http.ResponseWriter, r *http.Request, cartID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "cart_id",
		Value:    cartID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 60 * 60,
		Secure:   requestIsSecure(r),
	})
}

func requestIsSecure(r *http.Request) bool {
	if r != nil && r.TLS != nil {
		return true
	}
	if r != nil && strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}

func (m *module) resolveCustomerID(r *http.Request) (string, bool, error) {
	if m.customers == nil {
		return "", false, nil
	}
	customer, _, err := modcustomers.ResolveAuthenticatedCustomer(r.Context(), r, m.customers)
	if err != nil {
		if errors.Is(err, modcustomers.ErrUnauthenticated) {
			return "", false, nil
		}
		return "", false, err
	}
	return customer.ID, true, nil
}
