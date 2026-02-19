package cart

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Cart struct {
	ID         string
	CustomerID sql.NullString
	CreatedAt  time.Time
	UpdatedAt  time.Time
	Items      []CartItem
	Totals     Totals
}

type CartItem struct {
	ID               string
	CartID           string
	ProductVariantID string
	UnitPriceCents   int
	Currency         string
	Quantity         int
	ProductTitle     string
	ImageURL         string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type Totals struct {
	SubtotalCents int
	Currency      string
	ItemCount     int
}

type Store struct {
	db *sql.DB

	stmtCreateCart    *sql.Stmt
	stmtGetCartMeta   *sql.Stmt
	stmtListCartItems *sql.Stmt
	stmtGetVariant    *sql.Stmt
	stmtUpsertItem    *sql.Stmt
	stmtUpdateItemQty *sql.Stmt
	stmtDeleteItem    *sql.Stmt
}

func NewStore(ctx context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}

	stmtCreateCart, err := db.PrepareContext(ctx, `
		INSERT INTO carts DEFAULT VALUES
		RETURNING id, created_at, updated_at`)
	if err != nil {
		return nil, err
	}

	stmtGetCartMeta, err := db.PrepareContext(ctx, `
		SELECT id, customer_id, created_at, updated_at
		FROM carts WHERE id = $1`)
	if err != nil {
		return nil, err
	}

	stmtListCartItems, err := db.PrepareContext(ctx, `
		SELECT 
			ci.id, ci.cart_id, ci.product_variant_id, ci.unit_price_cents, ci.currency, ci.quantity, 
			p.title,
			COALESCE(img.url, '/images/noImage.png'),
			ci.created_at, ci.updated_at
		FROM cart_items ci
		JOIN product_variants pv ON ci.product_variant_id = pv.id
		JOIN products p ON pv.product_id = p.id
		LEFT JOIN LATERAL (
			SELECT url FROM images 
			WHERE product_id = p.id 
			ORDER BY sort ASC 
			LIMIT 1
		) img ON true
		WHERE ci.cart_id = $1
		ORDER BY ci.created_at ASC`)
	if err != nil {
		return nil, err
	}

	stmtGetVariant, err := db.PrepareContext(ctx, `
		SELECT price_cents, currency FROM product_variants WHERE id = $1`)
	if err != nil {
		return nil, err
	}

	stmtUpsertItem, err := db.PrepareContext(ctx, `
		INSERT INTO cart_items (cart_id, product_variant_id, unit_price_cents, currency, quantity)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (cart_id, product_variant_id)
		DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now()`)
	if err != nil {
		return nil, err
	}

	stmtUpdateItemQty, err := db.PrepareContext(ctx, `
		UPDATE cart_items SET quantity = $1, updated_at = now()
		WHERE id = $2 AND cart_id = $3`)
	if err != nil {
		return nil, err
	}

	stmtDeleteItem, err := db.PrepareContext(ctx, `
		DELETE FROM cart_items WHERE id = $1 AND cart_id = $2`)
	if err != nil {
		return nil, err
	}

	return &Store{
		db:                db,
		stmtCreateCart:    stmtCreateCart,
		stmtGetCartMeta:   stmtGetCartMeta,
		stmtListCartItems: stmtListCartItems,
		stmtGetVariant:    stmtGetVariant,
		stmtUpsertItem:    stmtUpsertItem,
		stmtUpdateItemQty: stmtUpdateItemQty,
		stmtDeleteItem:    stmtDeleteItem,
	}, nil
}

func (s *Store) Close() error {
	var firstErr error
	closers := []*sql.Stmt{
		s.stmtCreateCart,
		s.stmtGetCartMeta,
		s.stmtListCartItems,
		s.stmtGetVariant,
		s.stmtUpsertItem,
		s.stmtUpdateItemQty,
		s.stmtDeleteItem,
	}
	for _, c := range closers {
		if c == nil {
			continue
		}
		if err := c.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (s *Store) CreateCart(ctx context.Context) (Cart, error) {
	var c Cart
	if err := s.stmtCreateCart.QueryRowContext(ctx).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return Cart{}, err
	}
	c.CustomerID = sql.NullString{}
	c.Items = []CartItem{}
	c.Totals = Totals{SubtotalCents: 0, Currency: "", ItemCount: 0}
	return c, nil
}

func (s *Store) GetCart(ctx context.Context, cartID string) (Cart, error) {
	var c Cart
	if err := s.stmtGetCartMeta.QueryRowContext(ctx, cartID).Scan(&c.ID, &c.CustomerID, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return Cart{}, err
	}
	rows, err := s.stmtListCartItems.QueryContext(ctx, cartID)
	if err != nil {
		return Cart{}, err
	}
	defer rows.Close()
	var items []CartItem
	var subtotal int
	var currency string
	var itemCount int
	for rows.Next() {
		var it CartItem
		if err := rows.Scan(&it.ID, &it.CartID, &it.ProductVariantID, &it.UnitPriceCents, &it.Currency, &it.Quantity, &it.ProductTitle, &it.ImageURL, &it.CreatedAt, &it.UpdatedAt); err != nil {
			return Cart{}, err
		}
		items = append(items, it)
		subtotal += it.UnitPriceCents * it.Quantity
		itemCount += it.Quantity
		if currency == "" {
			currency = it.Currency
		}
	}
	if err := rows.Err(); err != nil {
		return Cart{}, err
	}
	c.Items = items
	c.Totals = Totals{SubtotalCents: subtotal, Currency: currency, ItemCount: itemCount}
	return c, nil
}

func (s *Store) ResolveCustomerCart(ctx context.Context, customerID, guestCartID string) (Cart, error) {
	if customerID == "" {
		return Cart{}, errors.New("customer id required")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Cart{}, err
	}
	defer func() { _ = tx.Rollback() }()

	customerCartID, err := ensureCustomerCartTx(ctx, tx, customerID)
	if err != nil {
		return Cart{}, err
	}

	if guestCartID != "" && guestCartID != customerCartID {
		if err := mergeGuestCartTx(ctx, tx, customerCartID, guestCartID); err != nil {
			return Cart{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return Cart{}, err
	}
	return s.GetCart(ctx, customerCartID)
}

func ensureCustomerCartTx(ctx context.Context, tx *sql.Tx, customerID string) (string, error) {
	var cartID string
	err := tx.QueryRowContext(ctx, `SELECT id FROM carts WHERE customer_id = $1`, customerID).Scan(&cartID)
	if err == nil {
		return cartID, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	err = tx.QueryRowContext(ctx, `
		INSERT INTO carts (customer_id)
		VALUES ($1)
		RETURNING id`, customerID).Scan(&cartID)
	if err == nil {
		return cartID, nil
	}

	// Concurrent creation may win the unique index first; in that case, read the cart.
	if err2 := tx.QueryRowContext(ctx, `SELECT id FROM carts WHERE customer_id = $1`, customerID).Scan(&cartID); err2 == nil {
		return cartID, nil
	}
	return "", err
}

func mergeGuestCartTx(ctx context.Context, tx *sql.Tx, customerCartID, guestCartID string) error {
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO cart_items (cart_id, product_variant_id, unit_price_cents, currency, quantity)
		SELECT $1, ci.product_variant_id, ci.unit_price_cents, ci.currency, ci.quantity
		FROM cart_items ci
		JOIN carts c ON c.id = ci.cart_id
		WHERE ci.cart_id = $2 AND c.customer_id IS NULL
		ON CONFLICT (cart_id, product_variant_id)
		DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now()`,
		customerCartID, guestCartID,
	); err != nil {
		return err
	}

	_, err := tx.ExecContext(ctx, `
		DELETE FROM cart_items ci
		USING carts c
		WHERE ci.cart_id = c.id
		AND c.id = $1
		AND c.customer_id IS NULL`, guestCartID)
	return err
}

func (s *Store) AddItem(ctx context.Context, cartID, variantID string, quantity int) (Cart, error) {
	if quantity <= 0 {
		return Cart{}, errors.New("quantity must be > 0")
	}
	var price int
	var currency string
	if err := s.stmtGetVariant.QueryRowContext(ctx, variantID).Scan(&price, &currency); err != nil {
		return Cart{}, err
	}
	if _, err := s.stmtUpsertItem.ExecContext(ctx, cartID, variantID, price, currency, quantity); err != nil {
		return Cart{}, err
	}
	return s.GetCart(ctx, cartID)
}

func (s *Store) UpdateItemQty(ctx context.Context, cartID, itemID string, quantity int) (Cart, error) {
	if quantity <= 0 {
		return Cart{}, errors.New("quantity must be > 0")
	}
	res, err := s.stmtUpdateItemQty.ExecContext(ctx, quantity, itemID, cartID)
	if err != nil {
		return Cart{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return Cart{}, err
	}
	if affected == 0 {
		return Cart{}, sql.ErrNoRows
	}
	return s.GetCart(ctx, cartID)
}

func (s *Store) RemoveItem(ctx context.Context, cartID, itemID string) (Cart, error) {
	res, err := s.stmtDeleteItem.ExecContext(ctx, itemID, cartID)
	if err != nil {
		return Cart{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return Cart{}, err
	}
	if affected == 0 {
		return Cart{}, sql.ErrNoRows
	}
	return s.GetCart(ctx, cartID)
}
