package checkout

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"goecommerce/internal/app"
	modcustomers "goecommerce/internal/modules/customers"
	platformshipping "goecommerce/internal/platform/shipping"
	storcart "goecommerce/internal/storage/cart"
	storcustomers "goecommerce/internal/storage/customers"
	stororders "goecommerce/internal/storage/orders"
	storshipping "goecommerce/internal/storage/shipping"
)

type module struct {
	db        *sql.DB
	cart      *storcart.Store
	customers *storcustomers.Store
	orders    *stororders.Store
	shipping  *storshipping.Store
	email     EmailService
}

type EmailService interface {
	SendOrderConfirmation(ctx context.Context, to, lang string, data map[string]any) error
}

type Option func(*module)

func WithEmailService(svc EmailService) Option {
	return func(m *module) {
		m.email = svc
	}
}

func NewModule(deps app.Deps, opts ...Option) app.Module {
	var db *sql.DB
	if deps.DB != nil {
		db = deps.DB
	}

	var cst *storcart.Store
	var cust *storcustomers.Store
	var ost *stororders.Store
	var sst *storshipping.Store

	if deps.DB != nil {
		if s, err := storcart.NewStore(context.Background(), deps.DB); err == nil {
			cst = s
		} else {
			slog.Error("module init: failed to create store", "module", "checkout", "store", "cart", "error", err)
		}
		if s, err := storcustomers.NewStore(context.Background(), deps.DB); err == nil {
			cust = s
		} else {
			slog.Error("module init: failed to create store", "module", "checkout", "store", "customers", "error", err)
		}
		if s, err := stororders.NewStore(context.Background(), deps.DB); err == nil {
			ost = s
		} else {
			slog.Error("module init: failed to create store", "module", "checkout", "store", "orders", "error", err)
		}
		if s, err := storshipping.NewStore(context.Background(), deps.DB); err == nil {
			sst = s
		} else {
			slog.Error("module init: failed to create store", "module", "checkout", "store", "shipping", "error", err)
		}
	}

	mod := &module{
		db:        db,
		cart:      cst,
		customers: cust,
		orders:    ost,
		shipping:  sst,
	}
	for _, opt := range opts {
		if opt != nil {
			opt(mod)
		}
	}
	return mod
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

func (m *module) Name() string { return "checkout" }

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/checkout/quote", m.handleQuote)
	mux.HandleFunc("/checkout/address", m.handleAddress)
	mux.HandleFunc("/checkout/select-shipping", m.handleSelectShipping)
	mux.HandleFunc("/checkout/select-payment", m.handleSelectPayment)
	mux.HandleFunc("/checkout/place-order", m.handlePlaceOrder)
}

// Address represents a shipping or billing address
type Address struct {
	FullName string `json:"full_name"`
	Phone    string `json:"phone"`
	Address1 string `json:"address1"`
	Address2 string `json:"address2"`
	City     string `json:"city"`
	State    string `json:"state"`
	Postcode string `json:"postcode"`
	Country  string `json:"country"`
}

// CompanyInfo represents company details for invoicing
type CompanyInfo struct {
	Name         string `json:"name"`
	VAT          string `json:"vat"`
	InvoiceEmail string `json:"invoice_email"`
}

// CheckoutSession holds the checkout state
type CheckoutSession struct {
	ShippingAddress  Address      `json:"shipping_address"`
	BillingAddress   *Address     `json:"billing_address,omitempty"`
	Company          *CompanyInfo `json:"company,omitempty"`
	UseSameAsBilling bool         `json:"use_same_as_billing"`

	ShippingMethodID   string `json:"shipping_method_id,omitempty"`
	ShippingTerminalID string `json:"shipping_terminal_id,omitempty"`
	ShippingPrice      int    `json:"shipping_price"`

	PaymentMethod   string `json:"payment_method,omitempty"`
	PaymentProvider string `json:"payment_provider,omitempty"`
}

// Validation errors
var (
	ErrAddressRequired        = errors.New("shipping address is required")
	ErrShippingMethodRequired = errors.New("shipping method is required")
	ErrTerminalRequired       = errors.New("terminal selection is required for this shipping method")
	ErrPaymentMethodRequired  = errors.New("payment method is required")
	ErrCartEmpty              = errors.New("cart is empty")
)

// ValidateAddress validates required address fields
func ValidateAddress(addr Address) error {
	if strings.TrimSpace(addr.FullName) == "" {
		return errors.New("full name is required")
	}
	if strings.TrimSpace(addr.Address1) == "" {
		return errors.New("address is required")
	}
	if strings.TrimSpace(addr.City) == "" {
		return errors.New("city is required")
	}
	if strings.TrimSpace(addr.Postcode) == "" {
		return errors.New("postcode is required")
	}
	if len(strings.TrimSpace(addr.Country)) != 2 {
		return errors.New("valid country code is required")
	}
	if strings.TrimSpace(addr.Phone) == "" {
		return errors.New("phone is required")
	}
	return nil
}

func readCartID(r *http.Request) (string, bool) {
	c, err := r.Cookie("cart_id")
	if err != nil {
		return "", false
	}
	return strings.TrimSpace(c.Value), true
}

func (m *module) resolveCustomer(r *http.Request) (storcustomers.Customer, bool, error) {
	if m.customers == nil {
		return storcustomers.Customer{}, false, nil
	}
	customer, _, err := modcustomers.ResolveAuthenticatedCustomer(r.Context(), r, m.customers)
	if err != nil {
		if errors.Is(err, modcustomers.ErrUnauthenticated) {
			return storcustomers.Customer{}, false, nil
		}
		return storcustomers.Customer{}, false, err
	}
	return customer, true, nil
}

func (m *module) getCart(r *http.Request) (storcart.Cart, string, error) {
	cartID, ok := readCartID(r)
	customer, authenticated, err := m.resolveCustomer(r)
	if err != nil {
		return storcart.Cart{}, "", err
	}

	var c storcart.Cart
	if authenticated {
		c, err = m.cart.ResolveCustomerCart(r.Context(), customer.ID, cartID)
		if err != nil {
			return storcart.Cart{}, "", err
		}
		return c, c.ID, nil
	}

	if !ok || strings.TrimSpace(cartID) == "" {
		return storcart.Cart{}, "", errors.New("no cart")
	}

	c, err = m.cart.GetCart(r.Context(), cartID)
	if err != nil {
		return storcart.Cart{}, "", err
	}
	return c, cartID, nil
}

// getShippingPrice calculates shipping price for a method
func (m *module) getShippingPrice(ctx context.Context, methodID string, cartValue int64) (int, error) {
	method, err := m.shipping.GetMethod(ctx, methodID)
	if err != nil {
		return 0, err
	}

	// Simple flat price calculation for MVP
	// TODO: Use the full pricing logic from http_storefront.calculateMethodPrice
	var rules map[string]any
	if len(method.PricingRulesJSON) > 0 {
		if err := json.Unmarshal(method.PricingRulesJSON, &rules); err != nil {
			rules = make(map[string]any)
		}
	}

	// Check for free shipping threshold
	if freeOver, ok := rules["freeOver"].(float64); ok {
		if cartValue >= int64(freeOver) {
			return 0, nil
		}
	}

	// Check for base price
	if price, ok := rules["price"].(float64); ok {
		return int(price), nil
	}

	return 0, nil
}

// checkMethodRequiresTerminal checks if a shipping method requires terminal selection
func (m *module) checkMethodRequiresTerminal(ctx context.Context, methodID string) (bool, error) {
	method, err := m.shipping.GetMethod(ctx, methodID)
	if err != nil {
		return false, err
	}

	caps, err := platformshipping.GetCapabilities(method.ProviderKey)
	if err != nil {
		return false, nil
	}
	return caps.Terminals, nil
}
