package cart

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"goecommerce/internal/app"
	modcustomers "goecommerce/internal/modules/customers"
	platformhttp "goecommerce/internal/platform/http"
	storcart "goecommerce/internal/storage/cart"
	storcustomers "goecommerce/internal/storage/customers"
)

type module struct {
	store         *storcart.Store
	customerStore *storcustomers.Store
}

func NewModule(deps app.Deps) app.Module {
	var s *storcart.Store
	var cs *storcustomers.Store
	if deps.DB != nil {
		if st, err := storcart.NewStore(context.Background(), deps.DB); err == nil {
			s = st
		}
		if st, err := storcustomers.NewStore(context.Background(), deps.DB); err == nil {
			cs = st
		}
	}
	return &module{store: s, customerStore: cs}
}

func (m *module) Close() error {
	if m.store != nil {
		return m.store.Close()
	}
	return nil
}

func (m *module) Name() string { return "cart" }

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/cart", m.handleCart)
	mux.HandleFunc("/cart/items", m.handleCartItems)
	mux.HandleFunc("/cart/items/", m.handleCartItemByID)
}

func (m *module) handleCart(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/cart" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	switch r.Method {
	case http.MethodPost:
		m.handleCartPost(w, r)
	case http.MethodGet:
		m.handleCartGet(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleCartPost(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	customerID, authenticated, err := m.resolveCustomerID(r)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}

	cartID, _ := readCartID(r)
	if authenticated {
		c, err := m.store.ResolveCustomerCart(ctx, customerID, cartID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "create error")
			return
		}
		setCartCookie(w, r, c.ID)
		_ = platformhttp.JSON(w, http.StatusOK, c)
		return
	}

	if cartID == "" {
		c, err := m.store.CreateCart(ctx)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "create error")
			return
		}
		setCartCookie(w, r, c.ID)
		_ = platformhttp.JSON(w, http.StatusOK, c)
		return
	}
	c, err := m.store.GetCart(ctx, cartID)
	if err != nil {
		if err == sql.ErrNoRows {
			c2, err2 := m.store.CreateCart(ctx)
			if err2 != nil {
				platformhttp.Error(w, http.StatusInternalServerError, "create error")
				return
			}
			setCartCookie(w, r, c2.ID)
			_ = platformhttp.JSON(w, http.StatusOK, c2)
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "get error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, c)
}

func (m *module) handleCartGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	customerID, authenticated, err := m.resolveCustomerID(r)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}

	cartID, ok := readCartID(r)
	if authenticated {
		c, err := m.store.ResolveCustomerCart(r.Context(), customerID, cartID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "get error")
			return
		}
		setCartCookie(w, r, c.ID)
		_ = platformhttp.JSON(w, http.StatusOK, c)
		return
	}

	if !ok || strings.TrimSpace(cartID) == "" {
		platformhttp.Error(w, http.StatusNotFound, "not found")
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	c, err := m.store.GetCart(r.Context(), cartID)
	if err != nil {
		if err == sql.ErrNoRows {
			platformhttp.Error(w, http.StatusNotFound, "not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "get error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, c)
}

func (m *module) handleCartItems(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/cart/items" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	customerID, authenticated, err := m.resolveCustomerID(r)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}
	cartID, ok := readCartID(r)
	if authenticated {
		c, err := m.store.ResolveCustomerCart(r.Context(), customerID, cartID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "get error")
			return
		}
		cartID = c.ID
		setCartCookie(w, r, cartID)
	} else if !ok || strings.TrimSpace(cartID) == "" {
		platformhttp.Error(w, http.StatusBadRequest, "no cart")
		return
	}
	var body struct {
		VariantID     string                              `json:"variant_id"`
		Quantity      int                                 `json:"quantity"`
		CustomOptions []storcart.AddItemCustomOptionInput `json:"custom_options"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}
	body.VariantID = strings.TrimSpace(body.VariantID)
	if body.VariantID == "" || body.Quantity <= 0 {
		platformhttp.Error(w, http.StatusBadRequest, "invalid input")
		return
	}
	c, err := m.store.AddItem(r.Context(), cartID, body.VariantID, body.Quantity, body.CustomOptions)
	if err != nil {
		if err == sql.ErrNoRows {
			platformhttp.Error(w, http.StatusNotFound, "not found")
			return
		}
		if errors.Is(err, storcart.ErrInvalidCustomOptions) {
			msg := strings.TrimPrefix(err.Error(), storcart.ErrInvalidCustomOptions.Error()+": ")
			platformhttp.Error(w, http.StatusBadRequest, msg)
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "add error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, c)
}

func (m *module) handleCartItemByID(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/cart/items/") {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	customerID, authenticated, err := m.resolveCustomerID(r)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}
	cartID, ok := readCartID(r)
	if authenticated {
		c, err := m.store.ResolveCustomerCart(r.Context(), customerID, cartID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "get error")
			return
		}
		cartID = c.ID
		setCartCookie(w, r, cartID)
	} else if !ok || strings.TrimSpace(cartID) == "" {
		platformhttp.Error(w, http.StatusBadRequest, "no cart")
		return
	}
	itemID := r.URL.Path[len("/cart/items/"):]
	if i := strings.IndexByte(itemID, '/'); i >= 0 {
		itemID = itemID[:i]
	}
	itemID = strings.TrimSpace(itemID)
	if itemID == "" {
		http.NotFound(w, r)
		return
	}
	switch r.Method {
	case http.MethodPatch:
		var body struct {
			Quantity int `json:"quantity"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid body")
			return
		}
		if body.Quantity <= 0 {
			platformhttp.Error(w, http.StatusBadRequest, "invalid input")
			return
		}
		c, err := m.store.UpdateItemQty(r.Context(), cartID, itemID, body.Quantity)
		if err != nil {
			if err == sql.ErrNoRows {
				platformhttp.Error(w, http.StatusNotFound, "not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "update error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, c)
	case http.MethodDelete:
		c, err := m.store.RemoveItem(r.Context(), cartID, itemID)
		if err != nil {
			if err == sql.ErrNoRows {
				platformhttp.Error(w, http.StatusNotFound, "not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "delete error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, c)
	default:
		http.NotFound(w, r)
	}
}

func readCartID(r *http.Request) (string, bool) {
	c, err := r.Cookie("cart_id")
	if err != nil {
		return "", false
	}
	return strings.TrimSpace(c.Value), true
}

func setCartCookie(w http.ResponseWriter, r *http.Request, cartID string) {
	cookie := &http.Cookie{
		Name:     "cart_id",
		Value:    cartID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 60 * 60,
		Secure:   isSecure(r),
	}
	http.SetCookie(w, cookie)
}

func isSecure(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	if strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}

func (m *module) resolveCustomerID(r *http.Request) (string, bool, error) {
	if m.customerStore == nil {
		return "", false, nil
	}
	customer, _, err := modcustomers.ResolveAuthenticatedCustomer(r.Context(), r, m.customerStore)
	if err != nil {
		if errors.Is(err, modcustomers.ErrUnauthenticated) {
			return "", false, nil
		}
		return "", false, err
	}
	return customer.ID, true, nil
}
