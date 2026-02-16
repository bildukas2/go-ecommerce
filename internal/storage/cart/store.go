package cart

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Cart struct {
	ID        string
	CreatedAt time.Time
	UpdatedAt time.Time
	Items     []CartItem
	Totals    Totals
}

type CartItem struct {
	ID               string
	CartID           string
	ProductVariantID string
	UnitPriceCents   int
	Currency         string
	Quantity         int
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
		SELECT id, created_at, updated_at
		FROM carts WHERE id = $1`)
	if err != nil {
		return nil, err
	}

	stmtListCartItems, err := db.PrepareContext(ctx, `
		SELECT id, cart_id, product_variant_id, unit_price_cents, currency, quantity, created_at, updated_at
		FROM cart_items WHERE cart_id = $1
		ORDER BY created_at ASC`)
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
	c.Items = []CartItem{}
	c.Totals = Totals{SubtotalCents: 0, Currency: "", ItemCount: 0}
	return c, nil
}

func (s *Store) GetCart(ctx context.Context, cartID string) (Cart, error) {
	var c Cart
	if err := s.stmtGetCartMeta.QueryRowContext(ctx, cartID).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt); err != nil {
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
		if err := rows.Scan(&it.ID, &it.CartID, &it.ProductVariantID, &it.UnitPriceCents, &it.Currency, &it.Quantity, &it.CreatedAt, &it.UpdatedAt); err != nil {
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
