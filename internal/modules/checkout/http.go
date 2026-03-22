package checkout

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"net/mail"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	"goecommerce/internal/platform/payments"
	platformshipping "goecommerce/internal/platform/shipping"
	stororders "goecommerce/internal/storage/orders"
	storpayments "goecommerce/internal/storage/payments"
	storshipping "goecommerce/internal/storage/shipping"
)

// handleQuote returns shipping options for a country
func (m *module) handleQuote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	if m.cart == nil || m.shipping == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var body struct {
		Country string `json:"country"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	country := strings.TrimSpace(body.Country)
	if len(country) != 2 {
		platformhttp.Error(w, http.StatusBadRequest, "valid country code is required")
		return
	}

	// Get cart for totals
	cart, _, err := m.getCart(r)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "cart not found")
		return
	}

	// Get zone by country
	zone, err := m.shipping.GetZoneByCountry(r.Context(), country)
	if err != nil {
		if err == sql.ErrNoRows {
			_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
				"zone":    nil,
				"methods": []any{},
				"totals": map[string]int{
					"subtotal": cart.Totals.SubtotalCents,
					"shipping": 0,
					"total":    cart.Totals.SubtotalCents,
				},
			})
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "error fetching zone")
		return
	}

	// Get methods for zone
	methods, err := m.shipping.ListMethodsByZone(r.Context(), zone.ID)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "error fetching methods")
		return
	}

	// Build response
	type methodDTO struct {
		ID               string `json:"id"`
		ZoneID           string `json:"zone_id"`
		ProviderKey      string `json:"provider_key"`
		ServiceCode      string `json:"service_code"`
		Title            string `json:"title"`
		Enabled          bool   `json:"enabled"`
		SortOrder        int    `json:"sort_order"`
		PricingMode      string `json:"pricing_mode"`
		Price            int    `json:"price"`
		Currency         string `json:"currency"`
		RequiresTerminal bool   `json:"requires_terminal"`
	}

	var methodDTOs []methodDTO
	for _, method := range methods {
		if !method.Enabled {
			continue
		}

		price := calculateMethodPrice(&method, int64(cart.Totals.SubtotalCents), 0, false)

		requiresTerminal := false
		if caps, err := platformshipping.GetCapabilities(method.ProviderKey); err == nil {
			requiresTerminal = caps.Terminals
		}

		methodDTOs = append(methodDTOs, methodDTO{
			ID:               method.ID,
			ZoneID:           method.ZoneID,
			ProviderKey:      method.ProviderKey,
			ServiceCode:      method.ServiceCode,
			Title:            method.Title,
			Enabled:          method.Enabled,
			SortOrder:        method.SortOrder,
			PricingMode:      method.PricingMode,
			Price:            price,
			Currency:         "EUR",
			RequiresTerminal: requiresTerminal,
		})
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"zone": map[string]any{
			"id":      zone.ID,
			"name":    zone.Name,
			"enabled": zone.Enabled,
		},
		"methods": methodDTOs,
		"totals": map[string]int{
			"subtotal": cart.Totals.SubtotalCents,
			"shipping": 0,
			"total":    cart.Totals.SubtotalCents,
		},
	})
}

// handleAddress saves shipping and billing address
func (m *module) handleAddress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	var body struct {
		Shipping         Address      `json:"shipping"`
		Billing          *Address     `json:"billing"`
		UseSameAsBilling bool         `json:"use_same_as_billing"`
		Company          *CompanyInfo `json:"company"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	// Validate shipping address
	if err := ValidateAddress(body.Shipping); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	// Validate billing address if provided and different
	if !body.UseSameAsBilling && body.Billing != nil {
		if err := ValidateAddress(*body.Billing); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "billing: "+err.Error())
			return
		}
	}

	// For MVP, we just return success - the frontend will store this state
	// In a full implementation, we'd store this in a checkout session
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"valid": true,
	})
}

// handleSelectShipping selects shipping method and terminal
func (m *module) handleSelectShipping(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	if m.shipping == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var body struct {
		MethodID   string `json:"method_id"`
		TerminalID string `json:"terminal_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	methodID := strings.TrimSpace(body.MethodID)
	if methodID == "" {
		platformhttp.Error(w, http.StatusBadRequest, "method_id is required")
		return
	}

	// Check if method requires terminal
	requiresTerminal, err := m.checkMethodRequiresTerminal(r.Context(), methodID)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid shipping method")
		return
	}

	if requiresTerminal && strings.TrimSpace(body.TerminalID) == "" {
		platformhttp.Error(w, http.StatusBadRequest, "terminal selection is required for this shipping method")
		return
	}

	// Get cart for totals
	cart, _, err := m.getCart(r)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "cart not found")
		return
	}

	// Calculate shipping price
	shippingPrice, err := m.getShippingPrice(r.Context(), methodID, int64(cart.Totals.SubtotalCents))
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "could not calculate shipping price")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"shipping_price": shippingPrice,
		"currency":       "EUR",
		"totals": map[string]int{
			"subtotal": cart.Totals.SubtotalCents,
			"shipping": shippingPrice,
			"total":    cart.Totals.SubtotalCents + shippingPrice,
		},
	})
}

// handleSelectPayment selects payment method
func (m *module) handleSelectPayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	var body struct {
		Method   string `json:"method"`
		Provider string `json:"provider"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	method := strings.TrimSpace(body.Method)
	if method == "" {
		platformhttp.Error(w, http.StatusBadRequest, "method is required")
		return
	}

	// Validate payment method
	validMethods := map[string]bool{
		"bank_transfer":    true,
		"cash_on_delivery": true,
	}
	if !validMethods[method] {
		platformhttp.Error(w, http.StatusBadRequest, "invalid payment method")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

// handlePlaceOrder creates the order with all checkout data
func (m *module) handlePlaceOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	if m.cart == nil || m.orders == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var body struct {
		Email              string       `json:"email"`
		Lang               string       `json:"lang"`
		ShippingAddress    Address      `json:"shipping_address"`
		BillingAddress     *Address     `json:"billing_address"`
		UseSameAsBilling   bool         `json:"use_same_as_billing"`
		Company            *CompanyInfo `json:"company"`
		ShippingMethodID   string       `json:"shipping_method_id"`
		ShippingTerminalID string       `json:"shipping_terminal_id"`
		ShippingPrice      int          `json:"shipping_price"`
		PaymentMethod      string       `json:"payment_method"`
		PaymentProvider    string       `json:"payment_provider"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	// Validate required fields
	if err := ValidateAddress(body.ShippingAddress); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "shipping address: "+err.Error())
		return
	}

	if body.ShippingMethodID == "" {
		platformhttp.Error(w, http.StatusBadRequest, "shipping method is required")
		return
	}

	if body.PaymentMethod == "" {
		platformhttp.Error(w, http.StatusBadRequest, "payment method is required")
		return
	}

	// Check if method requires terminal
	requiresTerminal, err := m.checkMethodRequiresTerminal(r.Context(), body.ShippingMethodID)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid shipping method")
		return
	}
	if requiresTerminal && body.ShippingTerminalID == "" {
		platformhttp.Error(w, http.StatusBadRequest, "terminal selection is required")
		return
	}

	// Get cart
	cart, cartID, err := m.getCart(r)
	if err != nil || len(cart.Items) == 0 {
		platformhttp.Error(w, http.StatusBadRequest, "cart is empty")
		return
	}

	// Get customer ID if authenticated
	customer, authenticated, err := m.resolveCustomer(r)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}

	// Create order with shipping/payment data
	order, err := m.createOrderWithCheckoutData(r.Context(), cart, customer.ID, authenticated, placeOrderInput{
		ShippingAddress:    body.ShippingAddress,
		BillingAddress:     body.BillingAddress,
		UseSameAsBilling:   body.UseSameAsBilling,
		Company:            body.Company,
		ShippingMethodID:   body.ShippingMethodID,
		ShippingTerminalID: body.ShippingTerminalID,
		ShippingPrice:      body.ShippingPrice,
		PaymentMethod:      body.PaymentMethod,
		PaymentProvider:    body.PaymentProvider,
	})
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	// Resolve email: authenticated customer > body.email > company invoice_email
	confirmEmail := customer.Email
	if confirmEmail == "" && strings.TrimSpace(body.Email) != "" {
		confirmEmail = strings.TrimSpace(body.Email)
	}
	// Prefer explicit lang from frontend, fall back to Accept-Language header
	emailLang := strings.ToLower(strings.TrimSpace(body.Lang))
	if emailLang == "" {
		emailLang = resolveRequestLanguage(r.Header.Get("Accept-Language"))
	}
	slog.Info("checkout: place-order email resolve", "customerEmail", customer.Email, "bodyEmail", body.Email, "confirmEmail", confirmEmail, "authenticated", authenticated, "lang", emailLang)
	m.sendOrderConfirmationBestEffort(r.Context(), order, confirmEmail, authenticated, body.Company, emailLang)

	// Clear cart after successful order (both authenticated and guest)
	for _, item := range cart.Items {
		_, _ = m.cart.RemoveItem(r.Context(), cartID, item.ID)
	}

	// Get payment URL
	var checkoutURL string
	if body.PaymentMethod != "cash_on_delivery" {
		pay := payments.NewFromEnv()
		checkoutURL, _ = pay.CreateCheckout(r.Context(), order.TotalCents, order.Currency, order.Number)
	} else {
		// For COD, redirect to success page
		checkoutURL = "/checkout/success?order=" + order.Number
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"order_id":     order.ID,
		"order_number": order.Number,
		"checkout_url": checkoutURL,
		"status":       order.Status,
	})
}

func (m *module) sendOrderConfirmationBestEffort(ctx context.Context, order stororders.Order, customerEmail string, authenticated bool, company *CompanyInfo, lang string) {
	if m.email == nil {
		slog.Warn("checkout: email service not configured, skipping order confirmation")
		return
	}

	to, ok := resolveConfirmationRecipient(customerEmail, authenticated, company)
	if !ok {
		slog.Warn("checkout: no valid email recipient found", "customerEmail", customerEmail, "authenticated", authenticated)
		return
	}
	slog.Info("checkout: sending order confirmation", "to", to, "order", order.Number)

	if lang == "" {
		lang = "en"
	}

	// Use shop settings currency if available, fall back to order currency
	currency := strings.ToUpper(strings.TrimSpace(order.Currency))
	if m.db != nil {
		var shopCurrency string
		if err := m.db.QueryRowContext(ctx, "SELECT currency FROM shop_settings WHERE id = 1").Scan(&shopCurrency); err == nil {
			if c := strings.ToUpper(strings.TrimSpace(shopCurrency)); c != "" {
				currency = c
			}
		}
	}

	payload := map[string]any{
		"OrderNumber": order.Number,
		"OrderID":     order.ID,
		"Currency":    currency,
		"Total":       formatCents(order.TotalCents),
	}

	if order.PaymentMethod == "bank_transfer" && m.payments != nil {
		payload["IsBankTransfer"] = true
		if pm, err := m.payments.GetMethodByKey(ctx, "bank-transfer"); err == nil && pm != nil {
			payload["PaymentTitle"] = strings.TrimSpace(pm.Title)
			payload["PaymentInstructions"] = strings.TrimSpace(pm.Instructions)
			var cfg storpayments.BankTransferConfig
			if len(pm.ConfigJSON) > 0 && json.Unmarshal(pm.ConfigJSON, &cfg) == nil {
				payload["BankAccountName"] = strings.TrimSpace(cfg.AccountName)
				payload["BankAccountNumber"] = strings.TrimSpace(cfg.AccountNumber)
				payload["BankName"] = strings.TrimSpace(cfg.BankName)
				payload["BankIBAN"] = strings.TrimSpace(cfg.IBAN)
				payload["BankBIC"] = strings.TrimSpace(cfg.BICSwift)
				payload["BankSortCode"] = strings.TrimSpace(cfg.SortCode)
			}
		}
	} else {
		payload["IsBankTransfer"] = false
	}

	err := m.email.SendOrderConfirmation(ctx, to, lang, payload)
	if err != nil {
		slog.Warn("checkout: order confirmation email failed", "order_id", order.ID, "error", err)
	}

	// Send notification to shop owners
	ownerEmails := m.email.GetOwnerEmails(ctx)
	for _, ownerEmail := range ownerEmails {
		if err := m.email.SendOrderConfirmation(ctx, ownerEmail, lang, payload); err != nil {
			slog.Warn("checkout: owner notification email failed", "owner", ownerEmail, "order_id", order.ID, "error", err)
		}
	}
}

func formatCents(cents int) string {
	sign := ""
	if cents < 0 {
		sign = "-"
		cents = -cents
	}
	return fmt.Sprintf("%s%d.%02d", sign, cents/100, cents%100)
}

func resolveConfirmationRecipient(customerEmail string, authenticated bool, company *CompanyInfo) (string, bool) {
	// Use customer email (from authenticated account or checkout email field)
	email := strings.ToLower(strings.TrimSpace(customerEmail))
	if isValidEmail(email) {
		return email, true
	}
	// Fallback to company invoice email
	if company != nil {
		email = strings.ToLower(strings.TrimSpace(company.InvoiceEmail))
		if isValidEmail(email) {
			return email, true
		}
	}

	return "", false
}

func resolveRequestLanguage(raw string) string {
	lang := strings.ToLower(strings.TrimSpace(raw))
	if i := strings.Index(lang, ","); i >= 0 {
		lang = lang[:i]
	}
	if i := strings.Index(lang, "-"); i >= 0 {
		lang = lang[:i]
	}
	if i := strings.Index(lang, ";"); i >= 0 {
		lang = lang[:i]
	}
	if len(lang) >= 2 {
		return lang[:2]
	}
	return "en"
}

func isValidEmail(email string) bool {
	if email == "" {
		return false
	}
	_, err := mail.ParseAddress(email)
	return err == nil
}

// calculateMethodPrice calculates shipping price based on pricing mode and rules
func calculateMethodPrice(method *storshipping.Method, cartValue int64, cartWeightKg float64, hasCartWeight bool) int {
	if method.PricingMode == "" {
		method.PricingMode = "flat"
	}

	var rules map[string]any
	if len(method.PricingRulesJSON) > 0 {
		if err := json.Unmarshal(method.PricingRulesJSON, &rules); err != nil {
			slog.Error("error unmarshaling pricing rules", "method_id", method.ID, "error", err)
			rules = make(map[string]any)
		}
	}

	lookupInt := func(obj map[string]any, keys ...string) (int64, bool) {
		for _, key := range keys {
			v, ok := obj[key]
			if !ok {
				continue
			}
			n, ok := v.(float64)
			if !ok || n < 0 || math.Trunc(n) != n {
				continue
			}
			return int64(n), true
		}
		return 0, false
	}

	mode := method.PricingMode
	switch mode {
	case "fixed":
		mode = "flat"
	case "table":
		mode = "weight_tiers"
	}

	switch mode {
	case "flat":
		freeOver, hasFreeOver := lookupInt(rules, "freeOver", "free_shipping_order_min_cents")
		if hasFreeOver && cartValue >= freeOver {
			return 0
		}
		if price, ok := lookupInt(rules, "price", "base_price_cents"); ok {
			return int(price)
		}
		return 0

	case "free":
		if always, ok := rules["always"].(bool); ok && always {
			return 0
		}
		return 0

	default:
		return 0
	}
}
