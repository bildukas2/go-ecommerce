package orders

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	storcart "goecommerce/internal/storage/cart"
)

type Order struct {
	ID            string
	Number        string
	Status        string
	Currency      string
	SubtotalCents int
	ShippingCents int
	TaxCents      int
	TotalCents    int
	CreatedAt     time.Time
	UpdatedAt     time.Time
	CustomerName  string
	CustomerInfo  string
	ShipmentType  string
	PaymentType   string
	Items         []OrderItem
}

type OrderItem struct {
	ID                string
	OrderID           string
	ProductVariantID  string
	UnitPriceCents    int
	Currency          string
	Quantity          int
	ProductTitle      string
	VariantSKU        string
	VariantAttrsJSON  []byte
	CustomOptionsJSON []byte
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type Store struct{ db *sql.DB }

func NewStore(_ context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return nil }

func generateOrderNumber(now time.Time) string {
	return fmt.Sprintf("ORD-%s-%d", now.UTC().Format("20060102"), now.UnixNano()%1000000)
}

func (s *Store) CreateFromCart(ctx context.Context, c storcart.Cart) (Order, error) {
	return s.CreateFromCartForCustomer(ctx, c, "")
}

func (s *Store) CreateFromCartForCustomer(ctx context.Context, c storcart.Cart, customerID string) (Order, error) {
	if c.ID == "" {
		return Order{}, errors.New("invalid cart")
	}
	if len(c.Items) == 0 {
		return Order{}, errors.New("empty cart")
	}
	currency := c.Totals.Currency
	if currency == "" {
		return Order{}, errors.New("invalid currency")
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
		if err := s.db.QueryRowContext(ctx, `
			SELECT pv.stock, p.title, pv.sku, COALESCE(pv.attributes_json, '{}'::jsonb)
			FROM product_variants pv
			JOIN products p ON p.id = pv.product_id
			WHERE pv.id = $1
		`, it.ProductVariantID).Scan(&stock, &productTitle, &variantSKU, &variantAttributes); err != nil {
			return Order{}, err
		}
		if stock < it.Quantity {
			return Order{}, errors.New("insufficient stock")
		}
		customOptions := it.CustomOptions
		if customOptions == nil {
			customOptions = []storcart.CartItemCustomOption{}
		}
		customOptionsJSON, err := json.Marshal(customOptions)
		if err != nil {
			return Order{}, fmt.Errorf("marshal custom options: %w", err)
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
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Order{}, err
	}
	defer func() { _ = tx.Rollback() }()
	now := time.Now()
	num := generateOrderNumber(now)
	var o Order
	var oid string
	if err := tx.QueryRowContext(ctx,
		"INSERT INTO orders (number, status, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, customer_id) VALUES ($1,'pending_payment',$2,$3,0,0,$4,NULLIF($5,'')::uuid) RETURNING id, number, status, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, created_at, updated_at",
		num, currency, c.Totals.SubtotalCents, c.Totals.SubtotalCents, customerID,
	).Scan(&o.ID, &o.Number, &o.Status, &o.Currency, &o.SubtotalCents, &o.ShippingCents, &o.TaxCents, &o.TotalCents, &o.CreatedAt, &o.UpdatedAt); err != nil {
		return Order{}, err
	}
	oid = o.ID
	items := make([]OrderItem, 0, len(c.Items))
	for _, it := range snapshotItems {
		var oi OrderItem
		if err := tx.QueryRowContext(ctx,
			"INSERT INTO order_items (order_id, product_variant_id, unit_price_cents, currency, quantity, product_title, variant_sku, variant_attributes_json, custom_options_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb) RETURNING id, order_id, product_variant_id, unit_price_cents, currency, quantity, product_title, variant_sku, variant_attributes_json, custom_options_json, created_at, updated_at",
			oid, it.ProductVariantID, it.UnitPriceCents, it.Currency, it.Quantity, it.ProductTitle, it.VariantSKU, it.VariantAttributes, it.CustomOptionsJSON,
		).Scan(&oi.ID, &oi.OrderID, &oi.ProductVariantID, &oi.UnitPriceCents, &oi.Currency, &oi.Quantity, &oi.ProductTitle, &oi.VariantSKU, &oi.VariantAttrsJSON, &oi.CustomOptionsJSON, &oi.CreatedAt, &oi.UpdatedAt); err != nil {
			return Order{}, err
		}
		items = append(items, oi)
	}
	o.Items = items
	if err := tx.Commit(); err != nil {
		return Order{}, err
	}
	return o, nil
}

func (s *Store) ListOrders(ctx context.Context, limit, offset int) ([]Order, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			o.id,
			o.number,
			o.status,
			o.currency,
			o.subtotal_cents,
			o.shipping_cents,
			o.tax_cents,
			o.total_cents,
			o.created_at,
			o.updated_at,
			COALESCE(
				NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), ''),
				NULLIF(TRIM(COALESCE(o.shipping_full_name, '')), ''),
				'Guest'
			) AS customer_name,
			COALESCE(
				NULLIF(TRIM(COALESCE(c.email, '')), ''),
				NULLIF(TRIM(COALESCE(o.invoice_email, '')), ''),
				NULLIF(TRIM(COALESCE(o.shipping_phone, '')), ''),
				''
			) AS customer_info,
			COALESCE(
				NULLIF(TRIM(COALESCE(sm.title, '')), ''),
				''
			) AS shipment_type,
			COALESCE(
				NULLIF(TRIM(COALESCE(o.payment_method, '')), ''),
				NULLIF(TRIM(COALESCE(o.payment_provider, '')), ''),
				''
			) AS payment_type
		FROM orders o
		LEFT JOIN customers c ON c.id = o.customer_id
		LEFT JOIN shipping_methods sm ON sm.id = o.shipping_method_id
		ORDER BY o.created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(
			&o.ID,
			&o.Number,
			&o.Status,
			&o.Currency,
			&o.SubtotalCents,
			&o.ShippingCents,
			&o.TaxCents,
			&o.TotalCents,
			&o.CreatedAt,
			&o.UpdatedAt,
			&o.CustomerName,
			&o.CustomerInfo,
			&o.ShipmentType,
			&o.PaymentType,
		); err != nil {
			return nil, err
		}
		items = append(items, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

type OrderMetrics struct {
	TotalOrders    int `json:"total_orders"`
	PendingPayment int `json:"pending_payment"`
	Paid           int `json:"paid"`
	Processing     int `json:"processing"`
	Completed      int `json:"completed"`
	Cancelled      int `json:"cancelled"`
}

func (s *Store) GetOrderMetrics(ctx context.Context) (OrderMetrics, error) {
	var m OrderMetrics
	err := s.db.QueryRowContext(ctx, `
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'pending_payment'),
			COUNT(*) FILTER (WHERE status = 'paid'),
			COUNT(*) FILTER (WHERE status = 'processing'),
			COUNT(*) FILTER (WHERE status = 'completed'),
			COUNT(*) FILTER (WHERE status = 'cancelled')
		FROM orders
	`).Scan(&m.TotalOrders, &m.PendingPayment, &m.Paid, &m.Processing, &m.Completed, &m.Cancelled)
	return m, err
}

func (s *Store) GetOrderByID(ctx context.Context, id string) (Order, error) {
	var o Order
	if err := s.db.QueryRowContext(ctx, "SELECT id, number, status, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, created_at, updated_at FROM orders WHERE id = $1", id).Scan(&o.ID, &o.Number, &o.Status, &o.Currency, &o.SubtotalCents, &o.ShippingCents, &o.TaxCents, &o.TotalCents, &o.CreatedAt, &o.UpdatedAt); err != nil {
		return Order{}, err
	}
	rows, err := s.db.QueryContext(ctx, "SELECT id, order_id, product_variant_id, unit_price_cents, currency, quantity, product_title, variant_sku, variant_attributes_json, custom_options_json, created_at, updated_at FROM order_items WHERE order_id = $1 ORDER BY created_at ASC", o.ID)
	if err != nil {
		return Order{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var it OrderItem
		if err := rows.Scan(&it.ID, &it.OrderID, &it.ProductVariantID, &it.UnitPriceCents, &it.Currency, &it.Quantity, &it.ProductTitle, &it.VariantSKU, &it.VariantAttrsJSON, &it.CustomOptionsJSON, &it.CreatedAt, &it.UpdatedAt); err != nil {
			return Order{}, err
		}
		o.Items = append(o.Items, it)
	}
	if err := rows.Err(); err != nil {
		return Order{}, err
	}
	return o, nil
}

func (s *Store) UpdateOrderStatus(ctx context.Context, id string, status string) error {
	_, err := s.db.ExecContext(ctx, "UPDATE orders SET status = $1, updated_at = now() WHERE id = $2", status, id)
	return err
}
