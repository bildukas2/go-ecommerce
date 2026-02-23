package checkout

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	storcart "goecommerce/internal/storage/cart"
	stororders "goecommerce/internal/storage/orders"
)

type placeOrderInput struct {
	ShippingAddress    Address
	BillingAddress     *Address
	UseSameAsBilling   bool
	Company            *CompanyInfo
	ShippingMethodID   string
	ShippingTerminalID string
	ShippingPrice      int
	PaymentMethod      string
	PaymentProvider    string
}

// createOrderWithCheckoutData creates an order with all checkout data
func (m *module) createOrderWithCheckoutData(ctx context.Context, c storcart.Cart, customerID string, authenticated bool, input placeOrderInput) (stororders.Order, error) {
	if m.db == nil {
		return stororders.Order{}, errors.New("database not available")
	}

	if c.ID == "" {
		return stororders.Order{}, errors.New("invalid cart")
	}
	if len(c.Items) == 0 {
		return stororders.Order{}, errors.New("empty cart")
	}

	currency := c.Totals.Currency
	if currency == "" {
		return stororders.Order{}, errors.New("invalid currency")
	}

	type orderItemSnapshot struct {
		ProductVariantID  string
		UnitPriceCents    int
		Currency          string
		Quantity          int
		ProductTitle      string
		VariantSKU        string
		VariantAttributes []byte
		CustomOptionsJSON []byte
	}

	snapshotItems := make([]orderItemSnapshot, 0, len(c.Items))
	for _, it := range c.Items {
		var (
			stock             int
			productTitle      string
			variantSKU        string
			variantAttributes []byte
		)
		if err := m.db.QueryRowContext(ctx, `
			SELECT pv.stock, p.title, pv.sku, COALESCE(pv.attributes_json, '{}'::jsonb)
			FROM product_variants pv
			JOIN products p ON p.id = pv.product_id
			WHERE pv.id = $1
		`, it.ProductVariantID).Scan(&stock, &productTitle, &variantSKU, &variantAttributes); err != nil {
			return stororders.Order{}, err
		}
		if stock < it.Quantity {
			return stororders.Order{}, errors.New("insufficient stock")
		}
		customOptionsJSON, err := marshalOrderItemCustomOptions(it.CustomOptions)
		if err != nil {
			return stororders.Order{}, fmt.Errorf("marshal custom options: %w", err)
		}
		snapshotItems = append(snapshotItems, orderItemSnapshot{
			ProductVariantID:  it.ProductVariantID,
			UnitPriceCents:    it.UnitPriceCents,
			Currency:          it.Currency,
			Quantity:          it.Quantity,
			ProductTitle:      productTitle,
			VariantSKU:        variantSKU,
			VariantAttributes: variantAttributes,
			CustomOptionsJSON: customOptionsJSON,
		})
	}

	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return stororders.Order{}, err
	}
	defer func() { _ = tx.Rollback() }()

	now := time.Now()
	num := generateOrderNumber(now)

	totalCents := int64(c.Totals.SubtotalCents) + int64(input.ShippingPrice)

	// Build insert query with all checkout fields
	query := `
		INSERT INTO orders (
			number, status, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, customer_id,
			shipping_method_id, shipping_terminal_id, shipping_price_cents,
			shipping_full_name, shipping_phone, shipping_address1, shipping_address2,
			shipping_city, shipping_state, shipping_postcode, shipping_country,
			billing_full_name, billing_address1, billing_address2,
			billing_city, billing_state, billing_postcode, billing_country,
			company_name, company_vat, invoice_email,
			payment_method, payment_provider
		) VALUES (
			$1, 'pending_payment', $2, $3, $4, 0, $5, NULLIF($6, '')::uuid,
			NULLIF($7, '')::uuid, NULLIF($8, ''), $9,
			$10, $11, $12, $13, $14, $15, $16, $17,
			$18, $19, $20, $21, $22, $23, $24,
			$25, $26, $27,
			$28, $29
		) RETURNING id, number, status, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, created_at, updated_at
	`

	var o stororders.Order
	err = tx.QueryRowContext(ctx, query,
		num, currency, c.Totals.SubtotalCents, input.ShippingPrice, totalCents, customerID,
		input.ShippingMethodID, input.ShippingTerminalID, input.ShippingPrice,
		input.ShippingAddress.FullName, input.ShippingAddress.Phone, input.ShippingAddress.Address1, input.ShippingAddress.Address2,
		input.ShippingAddress.City, input.ShippingAddress.State, input.ShippingAddress.Postcode, input.ShippingAddress.Country,
		// Billing address (use shipping if same)
		getBillingField(input, func(a Address) string { return a.FullName }),
		getBillingField(input, func(a Address) string { return a.Address1 }),
		getBillingField(input, func(a Address) string { return a.Address2 }),
		getBillingField(input, func(a Address) string { return a.City }),
		getBillingField(input, func(a Address) string { return a.State }),
		getBillingField(input, func(a Address) string { return a.Postcode }),
		getBillingField(input, func(a Address) string { return a.Country }),
		// Company
		getCompanyField(input.Company, func(c CompanyInfo) string { return c.Name }),
		getCompanyField(input.Company, func(c CompanyInfo) string { return c.VAT }),
		getCompanyField(input.Company, func(c CompanyInfo) string { return c.InvoiceEmail }),
		// Payment
		input.PaymentMethod, input.PaymentProvider,
	).Scan(&o.ID, &o.Number, &o.Status, &o.Currency, &o.SubtotalCents, &o.ShippingCents, &o.TaxCents, &o.TotalCents, &o.CreatedAt, &o.UpdatedAt)

	if err != nil {
		return stororders.Order{}, fmt.Errorf("insert order: %w", err)
	}

	// Insert order items
	items := make([]stororders.OrderItem, 0, len(c.Items))
	for _, it := range snapshotItems {
		var oi stororders.OrderItem
		if err := tx.QueryRowContext(ctx,
			"INSERT INTO order_items (order_id, product_variant_id, unit_price_cents, currency, quantity, product_title, variant_sku, variant_attributes_json, custom_options_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb) RETURNING id, order_id, product_variant_id, unit_price_cents, currency, quantity, product_title, variant_sku, variant_attributes_json, custom_options_json, created_at, updated_at",
			o.ID, it.ProductVariantID, it.UnitPriceCents, it.Currency, it.Quantity, it.ProductTitle, it.VariantSKU, it.VariantAttributes, it.CustomOptionsJSON,
		).Scan(&oi.ID, &oi.OrderID, &oi.ProductVariantID, &oi.UnitPriceCents, &oi.Currency, &oi.Quantity, &oi.ProductTitle, &oi.VariantSKU, &oi.VariantAttrsJSON, &oi.CustomOptionsJSON, &oi.CreatedAt, &oi.UpdatedAt); err != nil {
			return stororders.Order{}, fmt.Errorf("insert order item: %w", err)
		}
		items = append(items, oi)
	}
	o.Items = items

	if err := tx.Commit(); err != nil {
		return stororders.Order{}, err
	}

	return o, nil
}

type orderItemCustomOptionSnapshot struct {
	OptionID        string   `json:"option_id"`
	Title           string   `json:"title"`
	Type            string   `json:"type"`
	ValueID         string   `json:"value_id"`
	ValueIDs        []string `json:"value_ids"`
	ValueText       string   `json:"value_text"`
	ValueTitle      string   `json:"value_title"`
	ValueTitles     []string `json:"value_titles"`
	PriceDeltaCents int      `json:"price_delta_cents"`
}

func marshalOrderItemCustomOptions(options []storcart.CartItemCustomOption) ([]byte, error) {
	if options == nil {
		options = []storcart.CartItemCustomOption{}
	}
	out := make([]orderItemCustomOptionSnapshot, 0, len(options))
	for _, option := range options {
		out = append(out, orderItemCustomOptionSnapshot{
			OptionID:        option.OptionID,
			Title:           option.Title,
			Type:            option.Type,
			ValueID:         option.ValueID,
			ValueIDs:        option.ValueIDs,
			ValueText:       option.ValueText,
			ValueTitle:      option.ValueTitle,
			ValueTitles:     option.ValueTitles,
			PriceDeltaCents: option.PriceDeltaCents,
		})
	}
	return json.Marshal(out)
}

func getBillingField(input placeOrderInput, getter func(Address) string) string {
	if input.UseSameAsBilling || input.BillingAddress == nil {
		return getter(input.ShippingAddress)
	}
	return getter(*input.BillingAddress)
}

func getCompanyField(c *CompanyInfo, getter func(CompanyInfo) string) string {
	if c == nil {
		return ""
	}
	return getter(*c)
}

func generateOrderNumber(now time.Time) string {
	return fmt.Sprintf("ORD-%s-%d", now.UTC().Format("20060102"), now.UnixNano()%1000000)
}
