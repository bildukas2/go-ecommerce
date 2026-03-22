package customers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/mail"
	"os"
	"strconv"
	"strings"
	"time"

	"goecommerce/internal/app"
	platformhttp "goecommerce/internal/platform/http"
	platformshipping "goecommerce/internal/platform/shipping"
	storcart "goecommerce/internal/storage/cart"
	storcustomers "goecommerce/internal/storage/customers"
	storpayments "goecommerce/internal/storage/payments"
	storshipping "goecommerce/internal/storage/shipping"
)

const (
	minimumPasswordLength = 8
	defaultSessionTTL     = 30 * 24 * time.Hour
)

type customerStore interface {
	CreateCustomer(ctx context.Context, email, passwordHash string) (storcustomers.Customer, error)
	GetCustomerByEmail(ctx context.Context, email string) (storcustomers.Customer, error)
	CreateSession(ctx context.Context, customerID, tokenHash string, expiresAt time.Time) (storcustomers.Session, error)
	GetCustomerBySessionTokenHash(ctx context.Context, tokenHash string) (storcustomers.Customer, error)
	RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error
	RevokeSessionsByCustomerID(ctx context.Context, customerID string) error
	AddFavorite(ctx context.Context, customerID, productID string) (bool, error)
	RemoveFavorite(ctx context.Context, customerID, productID string) error
	ListFavorites(ctx context.Context, customerID string, page, limit int) (storcustomers.FavoritesPage, error)
	ListOrdersByCustomer(ctx context.Context, customerID string, page, limit int) (storcustomers.OrdersPage, error)
	UpdatePasswordAndRevokeSessions(ctx context.Context, customerID, passwordHash string) error
	GetOrderByCustomer(ctx context.Context, orderID, customerID string) (storcustomers.CustomerOrderDetail, error)
	GetProfile(ctx context.Context, customerID string) (storcustomers.CustomerProfile, error)
	UpdateProfile(ctx context.Context, customerID string, p storcustomers.CustomerProfile) error
	CreatePasswordResetToken(ctx context.Context, customerID, tokenHash string, expiresAt time.Time) error
	GetCustomerByResetTokenHash(ctx context.Context, tokenHash string) (storcustomers.Customer, error)
	MarkResetTokenUsed(ctx context.Context, tokenHash string) error
}

type paymentMethodStore interface {
	GetMethodByKey(ctx context.Context, key string) (*storpayments.PaymentMethod, error)
}

type terminalStore interface {
	GetCachedTerminals(ctx context.Context, providerKey, country string) ([]byte, time.Time, error)
}

// PasswordResetEmailService sends password reset emails.
type PasswordResetEmailService interface {
	SendPasswordReset(ctx context.Context, to, lang, resetURL string) error
}

// CustomerOption configures optional dependencies for the customers module.
type CustomerOption func(*module)

// WithEmailService injects the email service for password reset emails.
func WithEmailService(svc PasswordResetEmailService) CustomerOption {
	return func(m *module) {
		if svc != nil {
			m.email = svc
		}
	}
}

type module struct {
	store      customerStore
	cartStore  customerCartStore
	payments   paymentMethodStore
	terminals  terminalStore
	email      PasswordResetEmailService
	sessionTTL time.Duration
	now        func() time.Time
}

func NewModule(deps app.Deps, opts ...CustomerOption) app.Module {
	var store customerStore
	var cartStore customerCartStore
	var payments paymentMethodStore
	var terminals terminalStore
	if deps.DB != nil {
		if st, err := storcustomers.NewStore(context.Background(), deps.DB); err == nil {
			store = st
		} else {
			slog.Error("module init: failed to create store", "module", "customers", "store", "customers", "error", err)
		}
		if st, err := storcart.NewStore(context.Background(), deps.DB); err == nil {
			cartStore = st
		} else {
			slog.Error("module init: failed to create store", "module", "customers", "store", "cart", "error", err)
		}
		payments = storpayments.New(deps.DB)
		if st, err := storshipping.NewStore(context.Background(), deps.DB); err == nil {
			terminals = st
		} else {
			slog.Error("module init: failed to create store", "module", "customers", "store", "shipping", "error", err)
		}
	}
	m := &module{store: store, cartStore: cartStore, payments: payments, terminals: terminals, sessionTTL: defaultSessionTTL, now: time.Now}
	for _, opt := range opts {
		opt(m)
	}
	return m
}

func (m *module) Name() string { return "customers" }

func (m *module) Close() error {
	var firstErr error
	if closer, ok := m.store.(interface{ Close() error }); ok && closer != nil {
		if err := closer.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if closer, ok := m.cartStore.(interface{ Close() error }); ok && closer != nil {
		if err := closer.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/auth/register", m.handleRegister)
	mux.HandleFunc("/auth/login", m.handleLogin)
	mux.HandleFunc("/auth/logout", m.handleLogout)
	mux.HandleFunc("/auth/me", m.handleMe)
	mux.HandleFunc("/account/favorites", m.handleFavorites)
	mux.HandleFunc("/account/favorites/", m.handleFavorites)
	mux.HandleFunc("/account/orders", m.handleOrders)
	mux.HandleFunc("/account/orders/", m.handleOrderDetail)
	mux.HandleFunc("/account/change-password", m.handleChangePassword)
	mux.HandleFunc("/account/profile", m.handleProfile)
	mux.HandleFunc("/auth/forgot-password", m.handleForgotPassword)
	mux.HandleFunc("/auth/reset-password", m.handleResetPassword)
	mux.HandleFunc("/support/blocked-report", m.handleBlockedReport)
}

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authCustomerResponse struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

type customerCartStore interface {
	ResolveCustomerCart(ctx context.Context, customerID, guestCartID string) (storcart.Cart, error)
}

type favoriteRequest struct {
	ProductID string `json:"product_id"`
}

type passwordChangeRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (m *module) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/register" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	var body credentialsRequest
	if err := decodeAuthRequest(r, &body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	email, password, err := validateCredentials(body)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	passwordHash, err := hashPassword(password)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "register error")
		return
	}
	customer, err := m.store.CreateCustomer(r.Context(), email, passwordHash)
	if err != nil {
		if errors.Is(err, storcustomers.ErrConflict) {
			platformhttp.Error(w, http.StatusConflict, "email already in use")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "register error")
		return
	}
	if err := m.startSession(w, r, customer.ID); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "register error")
		return
	}
	infoSeverity := "info"
	m.writeCustomerActionLog(r, customerActionCreated, &customer.ID, &infoSeverity, map[string]any{
		"source": "auth.register",
	})
	_ = platformhttp.JSON(w, http.StatusCreated, toAuthResponse(customer))
}

func (m *module) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/login" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	var body credentialsRequest
	if err := decodeAuthRequest(r, &body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	email, password, err := validateCredentials(body)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	customer, err := m.store.GetCustomerByEmail(r.Context(), email)
	if err != nil || !verifyPassword(customer.PasswordHash, password) {
		platformhttp.Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if strings.EqualFold(customer.Status, "disabled") {
		platformhttp.Error(w, http.StatusForbidden, "account disabled")
		return
	}
	if err := m.startSession(w, r, customer.ID); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "login error")
		return
	}
	if m.cartStore != nil {
		guestCartID, _ := readCartID(r)
		canonicalCart, err := m.cartStore.ResolveCustomerCart(r.Context(), customer.ID, guestCartID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "login error")
			return
		}
		setCartCookie(w, r, canonicalCart.ID)
	}
	_ = platformhttp.JSON(w, http.StatusOK, toAuthResponse(customer))
}

func (m *module) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/logout" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	_, tokenHash, err := ResolveAuthenticatedCustomer(r.Context(), r, m.store)
	if err == nil {
		_ = m.store.RevokeSessionByTokenHash(r.Context(), tokenHash)
	}
	clearSessionCookie(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func (m *module) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || r.URL.Path != "/auth/me" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	customer, _, err := ResolveAuthenticatedCustomer(r.Context(), r, m.store)
	if err != nil {
		if errors.Is(err, ErrUnauthenticated) {
			platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, toAuthResponse(customer))
}

func (m *module) handleFavorites(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	customer, _, err := ResolveAuthenticatedCustomer(r.Context(), r, m.store)
	if err != nil {
		if errors.Is(err, ErrUnauthenticated) {
			platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}

	switch {
	case r.URL.Path == "/account/favorites" && r.Method == http.MethodGet:
		page, limit := parsePageLimit(r)
		favorites, err := m.store.ListFavorites(r.Context(), customer.ID, page, limit)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "list error")
			return
		}
		out := map[string]any{
			"items": favorites.Items,
			"total": favorites.Total,
			"page":  favorites.Page,
			"limit": favorites.Limit,
		}
		_ = platformhttp.JSON(w, http.StatusOK, out)
		return
	case r.URL.Path == "/account/favorites" && r.Method == http.MethodPost:
		var body favoriteRequest
		if err := decodeAuthRequest(r, &body); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		productID := strings.TrimSpace(body.ProductID)
		if productID == "" {
			platformhttp.Error(w, http.StatusBadRequest, "product_id is required")
			return
		}
		created, err := m.store.AddFavorite(r.Context(), customer.ID, productID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "favorite error")
			return
		}
		status := http.StatusOK
		if created {
			status = http.StatusCreated
		}
		_ = platformhttp.JSON(w, status, map[string]any{"product_id": productID})
		return
	case strings.HasPrefix(r.URL.Path, "/account/favorites/") && r.Method == http.MethodDelete:
		productID := strings.TrimSpace(r.URL.Path[len("/account/favorites/"):])
		if productID == "" || strings.Contains(productID, "/") {
			http.NotFound(w, r)
			return
		}
		if err := m.store.RemoveFavorite(r.Context(), customer.ID, productID); err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "favorite error")
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	default:
		http.NotFound(w, r)
		return
	}
}

func (m *module) handleOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || r.URL.Path != "/account/orders" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	customer, _, err := ResolveAuthenticatedCustomer(r.Context(), r, m.store)
	if err != nil {
		if errors.Is(err, ErrUnauthenticated) {
			platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}

	page, limit := parsePageLimit(r)
	orders, err := m.store.ListOrdersByCustomer(r.Context(), customer.ID, page, limit)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list error")
		return
	}
	out := map[string]any{
		"items": orders.Items,
		"total": orders.Total,
		"page":  orders.Page,
		"limit": orders.Limit,
	}
	_ = platformhttp.JSON(w, http.StatusOK, out)
}

type accountOrderItemResponse struct {
	ID             string          `json:"id"`
	ProductTitle   string          `json:"product_title"`
	VariantSKU     string          `json:"variant_sku"`
	Quantity       int             `json:"quantity"`
	UnitPriceCents int             `json:"unit_price_cents"`
	Currency       string          `json:"currency"`
	CustomOptions  json.RawMessage `json:"custom_options"`
}

type accountOrderBankConfigResponse struct {
	AccountName   string `json:"account_name"`
	AccountNumber string `json:"account_number"`
	BankName      string `json:"bank_name"`
	IBAN          string `json:"iban"`
	BICSwift      string `json:"bic_swift"`
	SortCode      string `json:"sort_code"`
}

type accountOrderPaymentResponse struct {
	Method       string                          `json:"method"`
	Provider     string                          `json:"provider"`
	Title        string                          `json:"title"`
	Description  string                          `json:"description"`
	Instructions string                          `json:"instructions"`
	BankConfig   *accountOrderBankConfigResponse `json:"bank_config"`
}

type accountOrderShippingResponse struct {
	MethodTitle     string `json:"method_title"`
	FullName        string `json:"full_name"`
	Phone           string `json:"phone"`
	Address1        string `json:"address1"`
	Address2        string `json:"address2"`
	City            string `json:"city"`
	State           string `json:"state"`
	Postcode        string `json:"postcode"`
	Country         string `json:"country"`
	TerminalName    string `json:"terminal_name"`
	TerminalAddress string `json:"terminal_address"`
}

type accountOrderDetailResponse struct {
	ID            string                       `json:"id"`
	Number        string                       `json:"number"`
	Status        string                       `json:"status"`
	Currency      string                       `json:"currency"`
	SubtotalCents int                          `json:"subtotal_cents"`
	ShippingCents int                          `json:"shipping_cents"`
	TaxCents      int                          `json:"tax_cents"`
	TotalCents    int                          `json:"total_cents"`
	CreatedAt     time.Time                    `json:"created_at"`
	Items         []accountOrderItemResponse   `json:"items"`
	Shipping      accountOrderShippingResponse `json:"shipping"`
	Payment       accountOrderPaymentResponse  `json:"payment"`
}

func (m *module) handleOrderDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	customer, _, err := ResolveAuthenticatedCustomer(r.Context(), r, m.store)
	if err != nil {
		if errors.Is(err, ErrUnauthenticated) {
			platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}

	orderID := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/account/orders/"))
	if orderID == "" || strings.Contains(orderID, "/") {
		platformhttp.Error(w, http.StatusBadRequest, "invalid order id")
		return
	}

	o, err := m.store.GetOrderByCustomer(r.Context(), orderID, customer.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			platformhttp.Error(w, http.StatusNotFound, "not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "order error")
		return
	}

	items := make([]accountOrderItemResponse, 0, len(o.Items))
	for _, it := range o.Items {
		customOpts := it.CustomOptions
		if customOpts == nil {
			customOpts = json.RawMessage("[]")
		}
		items = append(items, accountOrderItemResponse{
			ID:             it.ID,
			ProductTitle:   it.ProductTitle,
			VariantSKU:     it.VariantSKU,
			Quantity:       it.Quantity,
			UnitPriceCents: it.UnitPriceCents,
			Currency:       it.Currency,
			CustomOptions:  customOpts,
		})
	}

	var terminalName, terminalAddress string
	if o.ShippingTerminalID != "" && o.ShippingProviderKey != "" && m.terminals != nil {
		country := o.ShippingCountry
		if country == "" {
			country = "EE"
		}
		if cached, _, err := m.terminals.GetCachedTerminals(r.Context(), o.ShippingProviderKey, country); err == nil && len(cached) > 0 {
			var terminals []platformshipping.Terminal
			if err := json.Unmarshal(cached, &terminals); err == nil {
				for _, t := range terminals {
					if t.ID == o.ShippingTerminalID {
						terminalName = t.Name
						parts := []string{}
						if t.Address != "" {
							parts = append(parts, t.Address)
						}
						if t.City != "" {
							parts = append(parts, t.City)
						}
						if t.Postcode != "" {
							parts = append(parts, t.Postcode)
						}
						if len(parts) > 0 {
							terminalAddress = strings.Join(parts, ", ")
						}
						break
					}
				}
			}
		}
	}

	paymentResp := accountOrderPaymentResponse{
		Method:   o.PaymentMethod,
		Provider: o.PaymentProvider,
	}
	if o.PaymentMethod == "bank_transfer" && m.payments != nil {
		if pm, err := m.payments.GetMethodByKey(r.Context(), "bank-transfer"); err == nil && pm != nil {
			paymentResp.Title = pm.Title
			paymentResp.Description = pm.Description
			paymentResp.Instructions = pm.Instructions
			var cfg storpayments.BankTransferConfig
			if len(pm.ConfigJSON) > 0 {
				_ = json.Unmarshal(pm.ConfigJSON, &cfg)
			}
			paymentResp.BankConfig = &accountOrderBankConfigResponse{
				AccountName:   cfg.AccountName,
				AccountNumber: cfg.AccountNumber,
				BankName:      cfg.BankName,
				IBAN:          cfg.IBAN,
				BICSwift:      cfg.BICSwift,
				SortCode:      cfg.SortCode,
			}
		}
	}

	resp := accountOrderDetailResponse{
		ID:            o.ID,
		Number:        o.Number,
		Status:        o.Status,
		Currency:      o.Currency,
		SubtotalCents: o.SubtotalCents,
		ShippingCents: o.ShippingCents,
		TaxCents:      o.TaxCents,
		TotalCents:    o.TotalCents,
		CreatedAt:     o.CreatedAt,
		Items:         items,
		Shipping: accountOrderShippingResponse{
			MethodTitle:     o.ShippingMethodTitle,
			FullName:        o.ShippingFullName,
			Phone:           o.ShippingPhone,
			Address1:        o.ShippingAddress1,
			Address2:        o.ShippingAddress2,
			City:            o.ShippingCity,
			State:           o.ShippingState,
			Postcode:        o.ShippingPostcode,
			Country:         o.ShippingCountry,
			TerminalName:    terminalName,
			TerminalAddress: terminalAddress,
		},
		Payment: paymentResp,
	}
	_ = platformhttp.JSON(w, http.StatusOK, resp)
}

func (m *module) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/account/change-password" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	customer, _, err := ResolveAuthenticatedCustomer(r.Context(), r, m.store)
	if err != nil {
		if errors.Is(err, ErrUnauthenticated) {
			platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}

	var body passwordChangeRequest
	if err := decodeAuthRequest(r, &body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	currentPassword := strings.TrimSpace(body.CurrentPassword)
	newPassword := strings.TrimSpace(body.NewPassword)
	if currentPassword == "" || newPassword == "" {
		platformhttp.Error(w, http.StatusBadRequest, "current_password and new_password are required")
		return
	}
	if len(newPassword) < minimumPasswordLength {
		platformhttp.Error(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if !verifyPassword(customer.PasswordHash, currentPassword) {
		platformhttp.Error(w, http.StatusBadRequest, "current password is incorrect")
		return
	}
	passwordHash, err := hashPassword(newPassword)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "password change error")
		return
	}
	if err := m.store.UpdatePasswordAndRevokeSessions(r.Context(), customer.ID, passwordHash); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "password change error")
		return
	}
	infoSeverity := "info"
	m.writeCustomerActionLog(r, customerActionUpdated, &customer.ID, &infoSeverity, map[string]any{
		"source": "account.change_password",
	})
	clearSessionCookie(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func readCartID(r *http.Request) (string, bool) {
	cookie, err := r.Cookie("cart_id")
	if err != nil {
		return "", false
	}
	return strings.TrimSpace(cookie.Value), true
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

func toAuthResponse(c storcustomers.Customer) authCustomerResponse {
	return authCustomerResponse{ID: c.ID, Email: c.Email, CreatedAt: c.CreatedAt}
}

func (m *module) startSession(w http.ResponseWriter, r *http.Request, customerID string) error {
	token, err := generateSessionToken()
	if err != nil {
		return err
	}
	expiresAt := m.now().Add(m.sessionTTL)
	if _, err := m.store.CreateSession(r.Context(), customerID, hashSessionToken(token), expiresAt); err != nil {
		return err
	}
	setSessionCookie(w, r, token, int(m.sessionTTL.Seconds()))
	return nil
}

func decodeAuthRequest(r *http.Request, dst any) error {
	defer r.Body.Close()
	const maxBodyBytes = 1 << 20
	dec := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes+1))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return errors.New("invalid body")
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return errors.New("invalid body")
	}
	return nil
}

func validateCredentials(in credentialsRequest) (string, string, error) {
	email := strings.ToLower(strings.TrimSpace(in.Email))
	password := strings.TrimSpace(in.Password)
	if email == "" || password == "" {
		return "", "", errors.New("email and password are required")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return "", "", errors.New("invalid email")
	}
	if len(password) < minimumPasswordLength {
		return "", "", errors.New("password must be at least 8 characters")
	}
	return email, password, nil
}

func parsePageLimit(r *http.Request) (int, int) {
	page := atoiDefault(r.URL.Query().Get("page"), 1)
	limit := atoiDefault(r.URL.Query().Get("limit"), 20)
	return page, limit
}

func atoiDefault(s string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || n == 0 {
		return def
	}
	return n
}

func (m *module) handleProfile(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/account/profile" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	customer, _, err := ResolveAuthenticatedCustomer(r.Context(), r, m.store)
	if err != nil {
		platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	switch r.Method {
	case http.MethodGet:
		profile, err := m.store.GetProfile(r.Context(), customer.ID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to load profile")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, profile)

	case http.MethodPut:
		var body storcustomers.CustomerProfile
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid body")
			return
		}
		// Don't allow changing email via profile update
		body.Email = customer.Email
		if err := m.store.UpdateProfile(r.Context(), customer.ID, body); err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to update profile")
			return
		}
		// Return updated profile
		profile, err := m.store.GetProfile(r.Context(), customer.ID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to load profile")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, profile)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

const resetTokenTTL = 1 * time.Hour

func generateResetToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func storefrontBaseURL() string {
	if u := strings.TrimSpace(os.Getenv("STOREFRONT_URL")); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:3000"
}

func (m *module) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/forgot-password" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var body struct {
		Email string `json:"email"`
		Lang  string `json:"lang"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" {
		platformhttp.Error(w, http.StatusBadRequest, "email is required")
		return
	}

	// Always return success to prevent email enumeration
	respondOK := func() {
		_ = platformhttp.JSON(w, http.StatusOK, map[string]bool{"ok": true})
	}

	customer, err := m.store.GetCustomerByEmail(r.Context(), email)
	if err != nil {
		respondOK()
		return
	}

	token, err := generateResetToken()
	if err != nil {
		slog.Error("forgot-password: generate token", "error", err)
		respondOK()
		return
	}

	tokenHash := hashSessionToken(token)
	expiresAt := m.now().Add(resetTokenTTL)

	if err := m.store.CreatePasswordResetToken(r.Context(), customer.ID, tokenHash, expiresAt); err != nil {
		slog.Error("forgot-password: create token", "error", err)
		respondOK()
		return
	}

	lang := strings.ToLower(strings.TrimSpace(body.Lang))
	if lang == "" {
		lang = "en"
	}

	resetURL := fmt.Sprintf("%s/%s/account/reset-password?token=%s", storefrontBaseURL(), lang, token)

	if m.email != nil {
		slog.Info("forgot-password: sending reset email", "to", email, "lang", lang)
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if err := m.email.SendPasswordReset(ctx, email, lang, resetURL); err != nil {
				slog.Error("forgot-password: send email failed", "to", email, "error", err)
			} else {
				slog.Info("forgot-password: email sent", "to", email)
			}
		}()
	} else {
		slog.Warn("forgot-password: email service not configured", "email", email)
	}

	respondOK()
}

func (m *module) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/reset-password" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	token := strings.TrimSpace(body.Token)
	newPassword := strings.TrimSpace(body.NewPassword)

	if token == "" {
		platformhttp.Error(w, http.StatusBadRequest, "token is required")
		return
	}
	if len(newPassword) < minimumPasswordLength {
		platformhttp.Error(w, http.StatusBadRequest, fmt.Sprintf("password must be at least %d characters", minimumPasswordLength))
		return
	}

	tokenHash := hashSessionToken(token)

	customer, err := m.store.GetCustomerByResetTokenHash(r.Context(), tokenHash)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid or expired reset link")
		return
	}

	passwordHash, err := hashPassword(newPassword)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to process password")
		return
	}

	if err := m.store.UpdatePasswordAndRevokeSessions(r.Context(), customer.ID, passwordHash); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	if err := m.store.MarkResetTokenUsed(r.Context(), tokenHash); err != nil {
		slog.Error("reset-password: mark token used", "error", err)
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}
