package cart

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

var ErrInvalidCustomOptions = errors.New("invalid custom options")

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
	CustomOptions    []CartItemCustomOption
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type CartItemCustomOption struct {
	OptionID        string
	Title           string
	Type            string
	ValueID         string
	ValueIDs        []string
	ValueText       string
	ValueTitle      string
	ValueTitles     []string
	PriceDeltaCents int
}

type AddItemCustomOptionInput struct {
	OptionID  string   `json:"option_id"`
	Type      string   `json:"type"`
	ValueID   string   `json:"value_id"`
	ValueIDs  []string `json:"value_ids"`
	ValueText string   `json:"value_text"`
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
			ci.custom_options_json,
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
		SELECT product_id, price_cents, currency FROM product_variants WHERE id = $1`)
	if err != nil {
		return nil, err
	}

	stmtUpsertItem, err := db.PrepareContext(ctx, `
		INSERT INTO cart_items (cart_id, product_variant_id, unit_price_cents, currency, quantity, custom_options_json, custom_options_hash)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
		ON CONFLICT (cart_id, product_variant_id, custom_options_hash)
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
	items := make([]CartItem, 0)
	var subtotal int
	var currency string
	var itemCount int
	for rows.Next() {
		var it CartItem
		var customOptionsRaw []byte
		if err := rows.Scan(&it.ID, &it.CartID, &it.ProductVariantID, &it.UnitPriceCents, &it.Currency, &it.Quantity, &it.ProductTitle, &it.ImageURL, &customOptionsRaw, &it.CreatedAt, &it.UpdatedAt); err != nil {
			return Cart{}, err
		}
		if len(customOptionsRaw) > 0 {
			if err := json.Unmarshal(customOptionsRaw, &it.CustomOptions); err != nil {
				return Cart{}, err
			}
		}
		if it.CustomOptions == nil {
			it.CustomOptions = []CartItemCustomOption{}
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
		INSERT INTO cart_items (cart_id, product_variant_id, unit_price_cents, currency, quantity, custom_options_json, custom_options_hash)
		SELECT $1, ci.product_variant_id, ci.unit_price_cents, ci.currency, ci.quantity, ci.custom_options_json, ci.custom_options_hash
		FROM cart_items ci
		JOIN carts c ON c.id = ci.cart_id
		WHERE ci.cart_id = $2 AND c.customer_id IS NULL
		ON CONFLICT (cart_id, product_variant_id, custom_options_hash)
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

func (s *Store) AddItem(ctx context.Context, cartID, variantID string, quantity int, selectedOptions []AddItemCustomOptionInput) (Cart, error) {
	if quantity <= 0 {
		return Cart{}, errors.New("quantity must be > 0")
	}
	var productID string
	var basePrice int
	var currency string
	if err := s.stmtGetVariant.QueryRowContext(ctx, variantID).Scan(&productID, &basePrice, &currency); err != nil {
		return Cart{}, err
	}

	normalizedSelectedOptions, customOptionsDelta, err := s.resolveSelectedCustomOptions(ctx, productID, basePrice, selectedOptions)
	if err != nil {
		return Cart{}, err
	}
	customOptionsJSON, err := json.Marshal(normalizedSelectedOptions)
	if err != nil {
		return Cart{}, err
	}

	unitPrice := basePrice + customOptionsDelta
	if unitPrice < 0 {
		unitPrice = 0
	}
	customOptionsHash := hashCustomOptions(normalizedSelectedOptions)

	if _, err := s.stmtUpsertItem.ExecContext(ctx, cartID, variantID, unitPrice, currency, quantity, customOptionsJSON, customOptionsHash); err != nil {
		return Cart{}, err
	}
	return s.GetCart(ctx, cartID)
}

type catalogCustomOption struct {
	ID         string
	Title      string
	TypeGroup  string
	Type       string
	Required   bool
	PriceType  string
	PriceValue float64
	Values     []catalogCustomOptionValue
}

type catalogCustomOptionValue struct {
	ID         string
	Title      string
	PriceType  string
	PriceValue float64
	IsDefault  bool
}

func (s *Store) resolveSelectedCustomOptions(
	ctx context.Context,
	productID string,
	basePriceCents int,
	selectedOptions []AddItemCustomOptionInput,
) ([]CartItemCustomOption, int, error) {
	options, err := s.listProductCustomOptions(ctx, productID)
	if err != nil {
		return nil, 0, err
	}

	inputByOptionID := normalizeCustomOptionSelectionInput(selectedOptions)
	resolved := make([]CartItemCustomOption, 0, len(options))
	totalDelta := 0

	for _, option := range options {
		input, hasInput := inputByOptionID[option.ID]
		if hasInput && input.Type != "" && input.Type != option.Type {
			return nil, 0, invalidCustomOptions("selection type mismatch")
		}

		switch option.Type {
		case "dropdown", "radio":
			item, delta, ok, err := resolveSingleSelectOption(option, input, hasInput, basePriceCents)
			if err != nil {
				return nil, 0, err
			}
			if ok {
				resolved = append(resolved, item)
				totalDelta += delta
			}
		case "checkbox", "multiple":
			item, delta, ok, err := resolveMultiSelectOption(option, input, hasInput, basePriceCents)
			if err != nil {
				return nil, 0, err
			}
			if ok {
				resolved = append(resolved, item)
				totalDelta += delta
			}
		default:
			item, delta, ok, err := resolveTextLikeOption(option, input, hasInput, basePriceCents)
			if err != nil {
				return nil, 0, err
			}
			if ok {
				resolved = append(resolved, item)
				totalDelta += delta
			}
		}
	}

	sort.Slice(resolved, func(i, j int) bool {
		return resolved[i].OptionID < resolved[j].OptionID
	})
	return resolved, totalDelta, nil
}

func (s *Store) listProductCustomOptions(ctx context.Context, productID string) ([]catalogCustomOption, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT o.id, o.title, o.type_group, o.type, o.required, COALESCE(o.price_type, ''), COALESCE(o.price_value, 0)
		FROM product_custom_option_assignments a
		JOIN product_custom_options o ON o.id = a.option_id
		WHERE a.product_id = $1::uuid
		  AND o.is_active = true
		ORDER BY a.sort_order ASC, o.sort_order ASC, o.id ASC
	`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	options := make([]catalogCustomOption, 0, 8)
	for rows.Next() {
		var option catalogCustomOption
		if err := rows.Scan(
			&option.ID,
			&option.Title,
			&option.TypeGroup,
			&option.Type,
			&option.Required,
			&option.PriceType,
			&option.PriceValue,
		); err != nil {
			return nil, err
		}
		if option.TypeGroup == "select" {
			values, err := s.listCustomOptionValues(ctx, option.ID)
			if err != nil {
				return nil, err
			}
			option.Values = values
		} else {
			option.Values = []catalogCustomOptionValue{}
		}
		options = append(options, option)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return options, nil
}

func (s *Store) listCustomOptionValues(ctx context.Context, optionID string) ([]catalogCustomOptionValue, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, title, price_type, price_value, is_default
		FROM product_custom_option_values
		WHERE option_id = $1::uuid
		ORDER BY sort_order ASC, id ASC
	`, optionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	values := make([]catalogCustomOptionValue, 0, 8)
	for rows.Next() {
		var value catalogCustomOptionValue
		if err := rows.Scan(&value.ID, &value.Title, &value.PriceType, &value.PriceValue, &value.IsDefault); err != nil {
			return nil, err
		}
		values = append(values, value)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return values, nil
}

func resolveSingleSelectOption(
	option catalogCustomOption,
	input AddItemCustomOptionInput,
	hasInput bool,
	basePriceCents int,
) (CartItemCustomOption, int, bool, error) {
	valueByID := make(map[string]catalogCustomOptionValue, len(option.Values))
	defaultValueID := ""
	for _, value := range option.Values {
		valueByID[value.ID] = value
		if value.IsDefault && defaultValueID == "" {
			defaultValueID = value.ID
		}
	}

	selectedValueID := ""
	if hasInput {
		selectedValueID = input.ValueID
	}
	if selectedValueID == "" {
		selectedValueID = defaultValueID
	}

	if selectedValueID == "" {
		if option.Required {
			return CartItemCustomOption{}, 0, false, invalidCustomOptions(fmt.Sprintf("option %q is required", option.Title))
		}
		return CartItemCustomOption{}, 0, false, nil
	}

	value, ok := valueByID[selectedValueID]
	if !ok {
		return CartItemCustomOption{}, 0, false, invalidCustomOptions(fmt.Sprintf("invalid value for option %q", option.Title))
	}
	delta := priceDeltaCents(basePriceCents, value.PriceType, value.PriceValue)
	return CartItemCustomOption{
		OptionID:        option.ID,
		Title:           option.Title,
		Type:            option.Type,
		ValueID:         value.ID,
		ValueTitle:      value.Title,
		PriceDeltaCents: delta,
	}, delta, true, nil
}

func resolveMultiSelectOption(
	option catalogCustomOption,
	input AddItemCustomOptionInput,
	hasInput bool,
	basePriceCents int,
) (CartItemCustomOption, int, bool, error) {
	valueByID := make(map[string]catalogCustomOptionValue, len(option.Values))
	defaultIDs := make([]string, 0, len(option.Values))
	for _, value := range option.Values {
		valueByID[value.ID] = value
		if value.IsDefault {
			defaultIDs = append(defaultIDs, value.ID)
		}
	}

	selectedIDs := make([]string, 0, len(defaultIDs))
	if hasInput {
		selectedIDs = append(selectedIDs, input.ValueIDs...)
	}
	if len(selectedIDs) == 0 {
		selectedIDs = append(selectedIDs, defaultIDs...)
	}
	selectedIDs = uniqueSortedStrings(selectedIDs)

	if len(selectedIDs) == 0 {
		if option.Required {
			return CartItemCustomOption{}, 0, false, invalidCustomOptions(fmt.Sprintf("option %q is required", option.Title))
		}
		return CartItemCustomOption{}, 0, false, nil
	}

	valueTitles := make([]string, 0, len(selectedIDs))
	totalDelta := 0
	for _, selectedValueID := range selectedIDs {
		value, ok := valueByID[selectedValueID]
		if !ok {
			return CartItemCustomOption{}, 0, false, invalidCustomOptions(fmt.Sprintf("invalid value for option %q", option.Title))
		}
		valueTitles = append(valueTitles, value.Title)
		totalDelta += priceDeltaCents(basePriceCents, value.PriceType, value.PriceValue)
	}

	return CartItemCustomOption{
		OptionID:        option.ID,
		Title:           option.Title,
		Type:            option.Type,
		ValueIDs:        selectedIDs,
		ValueTitles:     valueTitles,
		PriceDeltaCents: totalDelta,
	}, totalDelta, true, nil
}

func resolveTextLikeOption(
	option catalogCustomOption,
	input AddItemCustomOptionInput,
	hasInput bool,
	basePriceCents int,
) (CartItemCustomOption, int, bool, error) {
	selectedText := ""
	if hasInput {
		selectedText = strings.TrimSpace(input.ValueText)
	}
	if selectedText == "" {
		if option.Required {
			return CartItemCustomOption{}, 0, false, invalidCustomOptions(fmt.Sprintf("option %q is required", option.Title))
		}
		return CartItemCustomOption{}, 0, false, nil
	}

	delta := priceDeltaCents(basePriceCents, option.PriceType, option.PriceValue)
	return CartItemCustomOption{
		OptionID:        option.ID,
		Title:           option.Title,
		Type:            option.Type,
		ValueText:       selectedText,
		PriceDeltaCents: delta,
	}, delta, true, nil
}

func normalizeCustomOptionSelectionInput(selectedOptions []AddItemCustomOptionInput) map[string]AddItemCustomOptionInput {
	out := make(map[string]AddItemCustomOptionInput, len(selectedOptions))
	for _, raw := range selectedOptions {
		optionID := strings.TrimSpace(raw.OptionID)
		if optionID == "" {
			continue
		}
		valueIDs := make([]string, 0, len(raw.ValueIDs))
		for _, valueID := range raw.ValueIDs {
			valueID = strings.TrimSpace(valueID)
			if valueID != "" {
				valueIDs = append(valueIDs, valueID)
			}
		}
		out[optionID] = AddItemCustomOptionInput{
			OptionID:  optionID,
			Type:      strings.TrimSpace(strings.ToLower(raw.Type)),
			ValueID:   strings.TrimSpace(raw.ValueID),
			ValueIDs:  uniqueSortedStrings(valueIDs),
			ValueText: strings.TrimSpace(raw.ValueText),
		}
	}
	return out
}

func uniqueSortedStrings(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	set := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := set[value]; ok {
			continue
		}
		set[value] = struct{}{}
		out = append(out, value)
	}
	sort.Strings(out)
	return out
}

func priceDeltaCents(basePriceCents int, priceType string, priceValue float64) int {
	switch strings.ToLower(strings.TrimSpace(priceType)) {
	case "fixed":
		return int(math.Round(priceValue * 100))
	case "percent":
		return int(math.Round(float64(basePriceCents) * priceValue / 100.0))
	default:
		return 0
	}
}

func hashCustomOptions(options []CartItemCustomOption) string {
	if len(options) == 0 {
		return ""
	}
	b, err := json.Marshal(options)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func invalidCustomOptions(message string) error {
	return fmt.Errorf("%w: %s", ErrInvalidCustomOptions, message)
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
