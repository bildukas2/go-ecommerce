package catalog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

const (
	CustomOptionTypeGroupText   = "text"
	CustomOptionTypeGroupFile   = "file"
	CustomOptionTypeGroupSelect = "select"
	CustomOptionTypeGroupDate   = "date"

	CustomOptionPriceTypeFixed   = "fixed"
	CustomOptionPriceTypePercent = "percent"

	CustomOptionDisplayModeDefault      = "default"
	CustomOptionDisplayModeButtons      = "buttons"
	CustomOptionDisplayModeColorButtons = "color_buttons"
)

var ErrInvalidInput = errors.New("catalog invalid input")

type ProductCustomOption struct {
	ID          string                     `json:"id"`
	StoreID     *string                    `json:"store_id"`
	Code        string                     `json:"code"`
	Title       string                     `json:"title"`
	TypeGroup   string                     `json:"type_group"`
	Type        string                     `json:"type"`
	Required    bool                       `json:"required"`
	SortOrder   int                        `json:"sort_order"`
	DisplayMode string                     `json:"display_mode"`
	PriceType   *string                    `json:"price_type"`
	PriceValue  *float64                   `json:"price_value"`
	IsActive    bool                       `json:"is_active"`
	CreatedAt   time.Time                  `json:"created_at"`
	UpdatedAt   time.Time                  `json:"updated_at"`
	Values      []ProductCustomOptionValue `json:"values"`
}

type ProductCustomOptionValue struct {
	ID         string    `json:"id"`
	OptionID   string    `json:"option_id"`
	Title      string    `json:"title"`
	SKU        *string   `json:"sku"`
	SortOrder  int       `json:"sort_order"`
	SwatchHex  *string   `json:"swatch_hex"`
	PriceType  string    `json:"price_type"`
	PriceValue float64   `json:"price_value"`
	IsDefault  bool      `json:"is_default"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type ProductCustomOptionAssignment struct {
	ProductID string `json:"product_id"`
	OptionID  string `json:"option_id"`
	SortOrder int    `json:"sort_order"`
}

type ListCustomOptionsParams struct {
	Query     string
	TypeGroup string
}

type CustomOptionValueUpsertInput struct {
	Title      string
	SKU        *string
	SortOrder  *int
	SwatchHex  *string
	PriceType  string
	PriceValue *float64
	IsDefault  bool
}

type CustomOptionUpsertInput struct {
	StoreID     *string
	Code        string
	Title       string
	TypeGroup   string
	Type        string
	Required    bool
	SortOrder   *int
	DisplayMode string
	PriceType   *string
	PriceValue  *float64
	IsActive    *bool
	Values      []CustomOptionValueUpsertInput
}

func (s *Store) ListCustomOptions(ctx context.Context, in ListCustomOptionsParams) ([]ProductCustomOption, error) {
	query := `
		SELECT id, store_id, code, title, type_group, type, required, sort_order, display_mode, price_type, price_value, is_active, created_at, updated_at
		FROM product_custom_options
		WHERE 1=1`
	args := make([]any, 0, 2)
	argIndex := 1

	if q := strings.TrimSpace(in.Query); q != "" {
		query += fmt.Sprintf(" AND title ILIKE $%d", argIndex)
		args = append(args, "%"+q+"%")
		argIndex++
	}
	if tg := strings.TrimSpace(strings.ToLower(in.TypeGroup)); tg != "" {
		query += fmt.Sprintf(" AND type_group = $%d", argIndex)
		args = append(args, tg)
	}
	query += " ORDER BY sort_order ASC, updated_at DESC, id ASC"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]ProductCustomOption, 0, 32)
	for rows.Next() {
		item, err := scanCustomOption(rows)
		if err != nil {
			return nil, err
		}
		item.Values = []ProductCustomOptionValue{}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) CreateCustomOption(ctx context.Context, in CustomOptionUpsertInput) (ProductCustomOption, error) {
	normalized, err := validateAndNormalizeCustomOptionInput(in)
	if err != nil {
		return ProductCustomOption{}, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ProductCustomOption{}, err
	}
	defer tx.Rollback()

	var (
		item      ProductCustomOption
		storeID   sql.NullString
		priceType sql.NullString
		priceVal  sql.NullFloat64
	)
	err = tx.QueryRowContext(ctx, `
		INSERT INTO product_custom_options (
			store_id, code, title, type_group, type, required, sort_order, display_mode, price_type, price_value, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, store_id, code, title, type_group, type, required, sort_order, display_mode, price_type, price_value, is_active, created_at, updated_at
	`,
		toNullString(normalized.StoreID),
		normalized.Code,
		normalized.Title,
		normalized.TypeGroup,
		normalized.Type,
		normalized.Required,
		normalized.SortOrder,
		normalized.DisplayMode,
		toNullString(normalized.PriceType),
		toNullFloat64(normalized.PriceValue),
		normalized.IsActive,
	).Scan(
		&item.ID,
		&storeID,
		&item.Code,
		&item.Title,
		&item.TypeGroup,
		&item.Type,
		&item.Required,
		&item.SortOrder,
		&item.DisplayMode,
		&priceType,
		&priceVal,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return ProductCustomOption{}, ErrConflict
		}
		return ProductCustomOption{}, err
	}
	item.StoreID = fromNullString(storeID)
	item.PriceType = fromNullString(priceType)
	item.PriceValue = fromNullFloat64(priceVal)

	values, err := replaceCustomOptionValuesTx(ctx, tx, item.ID, normalized)
	if err != nil {
		return ProductCustomOption{}, err
	}
	item.Values = values

	if err := tx.Commit(); err != nil {
		return ProductCustomOption{}, err
	}
	return item, nil
}

func (s *Store) GetCustomOptionByID(ctx context.Context, id string) (ProductCustomOption, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, store_id, code, title, type_group, type, required, sort_order, display_mode, price_type, price_value, is_active, created_at, updated_at
		FROM product_custom_options
		WHERE id = $1::uuid
	`, id)
	item, err := scanCustomOption(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ProductCustomOption{}, ErrNotFound
		}
		return ProductCustomOption{}, err
	}

	values, err := listCustomOptionValues(ctx, s.db, item.ID)
	if err != nil {
		return ProductCustomOption{}, err
	}
	item.Values = values
	return item, nil
}

func (s *Store) UpdateCustomOption(ctx context.Context, id string, in CustomOptionUpsertInput) (ProductCustomOption, error) {
	normalized, err := validateAndNormalizeCustomOptionInput(in)
	if err != nil {
		return ProductCustomOption{}, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ProductCustomOption{}, err
	}
	defer tx.Rollback()

	var (
		item      ProductCustomOption
		storeID   sql.NullString
		priceType sql.NullString
		priceVal  sql.NullFloat64
	)
	err = tx.QueryRowContext(ctx, `
		UPDATE product_custom_options
		SET store_id = $2,
			code = $3,
			title = $4,
			type_group = $5,
			type = $6,
			required = $7,
			sort_order = $8,
			display_mode = $9,
			price_type = $10,
			price_value = $11,
			is_active = $12,
			updated_at = now()
		WHERE id = $1::uuid
		RETURNING id, store_id, code, title, type_group, type, required, sort_order, display_mode, price_type, price_value, is_active, created_at, updated_at
	`,
		id,
		toNullString(normalized.StoreID),
		normalized.Code,
		normalized.Title,
		normalized.TypeGroup,
		normalized.Type,
		normalized.Required,
		normalized.SortOrder,
		normalized.DisplayMode,
		toNullString(normalized.PriceType),
		toNullFloat64(normalized.PriceValue),
		normalized.IsActive,
	).Scan(
		&item.ID,
		&storeID,
		&item.Code,
		&item.Title,
		&item.TypeGroup,
		&item.Type,
		&item.Required,
		&item.SortOrder,
		&item.DisplayMode,
		&priceType,
		&priceVal,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ProductCustomOption{}, ErrNotFound
		}
		if isUniqueViolation(err) {
			return ProductCustomOption{}, ErrConflict
		}
		return ProductCustomOption{}, err
	}
	item.StoreID = fromNullString(storeID)
	item.PriceType = fromNullString(priceType)
	item.PriceValue = fromNullFloat64(priceVal)

	values, err := replaceCustomOptionValuesTx(ctx, tx, item.ID, normalized)
	if err != nil {
		return ProductCustomOption{}, err
	}
	item.Values = values

	if err := tx.Commit(); err != nil {
		return ProductCustomOption{}, err
	}
	return item, nil
}

func (s *Store) DeleteCustomOption(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var assignmentCount int
	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM product_custom_option_assignments
		WHERE option_id = $1::uuid
	`, id).Scan(&assignmentCount); err != nil {
		return err
	}
	if assignmentCount > 0 {
		return ErrConflict
	}

	res, err := tx.ExecContext(ctx, `DELETE FROM product_custom_options WHERE id = $1::uuid`, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrNotFound
	}
	return tx.Commit()
}

func (s *Store) ListProductCustomOptionAssignments(ctx context.Context, productID string) ([]ProductCustomOptionAssignment, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT product_id, option_id, sort_order
		FROM product_custom_option_assignments
		WHERE product_id = $1::uuid
		ORDER BY sort_order ASC, option_id ASC
	`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]ProductCustomOptionAssignment, 0, 8)
	for rows.Next() {
		var item ProductCustomOptionAssignment
		if err := rows.Scan(&item.ProductID, &item.OptionID, &item.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) AttachProductCustomOption(ctx context.Context, productID, optionID string, sortOrder *int) (ProductCustomOptionAssignment, error) {
	nextSortOrder := 0
	if sortOrder != nil {
		nextSortOrder = *sortOrder
	}

	var out ProductCustomOptionAssignment
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO product_custom_option_assignments (product_id, option_id, sort_order)
		VALUES ($1::uuid, $2::uuid, $3)
		RETURNING product_id, option_id, sort_order
	`, productID, optionID, nextSortOrder).Scan(&out.ProductID, &out.OptionID, &out.SortOrder)
	if err != nil {
		if isUniqueViolation(err) {
			return ProductCustomOptionAssignment{}, ErrConflict
		}
		if isForeignKeyViolation(err) {
			return ProductCustomOptionAssignment{}, ErrNotFound
		}
		return ProductCustomOptionAssignment{}, err
	}
	return out, nil
}

func (s *Store) DetachProductCustomOption(ctx context.Context, productID, optionID string) error {
	res, err := s.db.ExecContext(ctx, `
		DELETE FROM product_custom_option_assignments
		WHERE product_id = $1::uuid
		  AND option_id = $2::uuid
	`, productID, optionID)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

type normalizedCustomOptionInput struct {
	StoreID     *string
	Code        string
	Title       string
	TypeGroup   string
	Type        string
	Required    bool
	SortOrder   int
	DisplayMode string
	PriceType   *string
	PriceValue  *float64
	IsActive    bool
	Values      []normalizedCustomOptionValueInput
}

type normalizedCustomOptionValueInput struct {
	Title      string
	SKU        *string
	SortOrder  int
	SwatchHex  *string
	PriceType  string
	PriceValue float64
	IsDefault  bool
}

var hexColorPattern = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

func isValidCustomOptionDisplayMode(v string) bool {
	switch v {
	case CustomOptionDisplayModeDefault, CustomOptionDisplayModeButtons, CustomOptionDisplayModeColorButtons:
		return true
	default:
		return false
	}
}

func isValidSwatchHex(v *string) bool {
	if v == nil {
		return true
	}
	trimmed := strings.TrimSpace(*v)
	if trimmed == "" {
		return true
	}
	return hexColorPattern.MatchString(trimmed)
}

func validateAndNormalizeCustomOptionInput(in CustomOptionUpsertInput) (normalizedCustomOptionInput, error) {
	title := strings.TrimSpace(in.Title)
	if len(title) < 2 {
		return normalizedCustomOptionInput{}, invalidInput("title must be at least 2 characters")
	}

	code := strings.TrimSpace(strings.ToLower(in.Code))
	if code == "" {
		return normalizedCustomOptionInput{}, invalidInput("code is required")
	}

	typeGroup := strings.TrimSpace(strings.ToLower(in.TypeGroup))
	if !isValidCustomOptionTypeGroup(typeGroup) {
		return normalizedCustomOptionInput{}, invalidInput("invalid type_group")
	}

	optionType := strings.TrimSpace(strings.ToLower(in.Type))
	if !isValidCustomOptionType(typeGroup, optionType) {
		return normalizedCustomOptionInput{}, invalidInput("invalid type for type_group")
	}

	sortOrder := 0
	if in.SortOrder != nil {
		sortOrder = *in.SortOrder
	}

	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}

	displayMode := strings.TrimSpace(strings.ToLower(in.DisplayMode))
	if displayMode == "" {
		displayMode = CustomOptionDisplayModeDefault
	}

	if !isValidCustomOptionDisplayMode(displayMode) {
		return normalizedCustomOptionInput{}, invalidInput("invalid display_mode, must be one of: default, buttons, color_buttons")
	}

	if displayMode != CustomOptionDisplayModeDefault && typeGroup != CustomOptionTypeGroupSelect {
		return normalizedCustomOptionInput{}, invalidInput("display_mode can only be used with select type options")
	}

	out := normalizedCustomOptionInput{
		StoreID:     normalizeOptionalTrimmedString(in.StoreID),
		Code:        code,
		Title:       title,
		TypeGroup:   typeGroup,
		Type:        optionType,
		Required:    in.Required,
		SortOrder:   sortOrder,
		DisplayMode: displayMode,
		IsActive:    isActive,
	}

	if typeGroup == CustomOptionTypeGroupSelect {
		if len(in.Values) == 0 {
			return normalizedCustomOptionInput{}, invalidInput("select options must include at least one value")
		}
		values := make([]normalizedCustomOptionValueInput, 0, len(in.Values))
		for i, value := range in.Values {
			normalized, err := normalizeCustomOptionValueInput(value)
			if err != nil {
				return normalizedCustomOptionInput{}, invalidInput(fmt.Sprintf("value[%d]: %s", i, err.Error()))
			}
			values = append(values, normalized)
		}
		out.Values = values
		return out, nil
	}

	if len(in.Values) > 0 {
		return normalizedCustomOptionInput{}, invalidInput("non-select options cannot include values")
	}
	priceType, err := normalizeCustomOptionPriceType(in.PriceType)
	if err != nil {
		return normalizedCustomOptionInput{}, err
	}
	if in.PriceValue == nil {
		return normalizedCustomOptionInput{}, invalidInput("price_value is required")
	}
	if *in.PriceValue < 0 {
		return normalizedCustomOptionInput{}, invalidInput("price_value must be >= 0")
	}
	priceValue := *in.PriceValue
	out.PriceType = &priceType
	out.PriceValue = &priceValue
	out.Values = []normalizedCustomOptionValueInput{}
	return out, nil
}

func normalizeCustomOptionValueInput(in CustomOptionValueUpsertInput) (normalizedCustomOptionValueInput, error) {
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return normalizedCustomOptionValueInput{}, errors.New("title is required")
	}
	priceType, err := normalizeCustomOptionPriceType(&in.PriceType)
	if err != nil {
		return normalizedCustomOptionValueInput{}, err
	}
	if in.PriceValue == nil {
		return normalizedCustomOptionValueInput{}, errors.New("price_value is required")
	}
	if *in.PriceValue < 0 {
		return normalizedCustomOptionValueInput{}, errors.New("price_value must be >= 0")
	}
	sortOrder := 0
	if in.SortOrder != nil {
		sortOrder = *in.SortOrder
	}
	sku := normalizeOptionalTrimmedString(in.SKU)
	swatchHex := normalizeOptionalTrimmedString(in.SwatchHex)
	if !isValidSwatchHex(swatchHex) {
		return normalizedCustomOptionValueInput{}, errors.New("swatch_hex must be a valid hex color in format #RRGGBB")
	}
	return normalizedCustomOptionValueInput{
		Title:      title,
		SKU:        sku,
		SortOrder:  sortOrder,
		SwatchHex:  swatchHex,
		PriceType:  priceType,
		PriceValue: *in.PriceValue,
		IsDefault:  in.IsDefault,
	}, nil
}

func normalizeCustomOptionPriceType(priceType *string) (string, error) {
	v := normalizeOptionalTrimmedString(priceType)
	if v == nil {
		return "", invalidInput("price_type is required")
	}
	normalized := strings.ToLower(*v)
	switch normalized {
	case CustomOptionPriceTypeFixed, CustomOptionPriceTypePercent:
		return normalized, nil
	default:
		return "", invalidInput("price_type must be fixed or percent")
	}
}

func isValidCustomOptionTypeGroup(v string) bool {
	switch v {
	case CustomOptionTypeGroupText, CustomOptionTypeGroupFile, CustomOptionTypeGroupSelect, CustomOptionTypeGroupDate:
		return true
	default:
		return false
	}
}

func isValidCustomOptionType(typeGroup, optionType string) bool {
	switch typeGroup {
	case CustomOptionTypeGroupText:
		return optionType == "field" || optionType == "area"
	case CustomOptionTypeGroupFile:
		return optionType == "file"
	case CustomOptionTypeGroupSelect:
		return optionType == "dropdown" || optionType == "radio" || optionType == "checkbox" || optionType == "multiple"
	case CustomOptionTypeGroupDate:
		return optionType == "date" || optionType == "datetime" || optionType == "time"
	default:
		return false
	}
}

func invalidInput(message string) error {
	return fmt.Errorf("%w: %s", ErrInvalidInput, message)
}

func replaceCustomOptionValuesTx(ctx context.Context, tx *sql.Tx, optionID string, in normalizedCustomOptionInput) ([]ProductCustomOptionValue, error) {
	if _, err := tx.ExecContext(ctx, `DELETE FROM product_custom_option_values WHERE option_id = $1::uuid`, optionID); err != nil {
		return nil, err
	}
	if in.TypeGroup != CustomOptionTypeGroupSelect {
		return []ProductCustomOptionValue{}, nil
	}

	values := make([]ProductCustomOptionValue, 0, len(in.Values))
	for _, value := range in.Values {
		var item ProductCustomOptionValue
		var sku sql.NullString
		var swatchHex sql.NullString
		err := tx.QueryRowContext(ctx, `
			INSERT INTO product_custom_option_values (option_id, title, sku, sort_order, swatch_hex, price_type, price_value, is_default)
			VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id, option_id, title, sku, sort_order, swatch_hex, price_type, price_value, is_default, created_at, updated_at
		`,
			optionID,
			value.Title,
			toNullString(value.SKU),
			value.SortOrder,
			toNullString(value.SwatchHex),
			value.PriceType,
			value.PriceValue,
			value.IsDefault,
		).Scan(
			&item.ID,
			&item.OptionID,
			&item.Title,
			&sku,
			&item.SortOrder,
			&swatchHex,
			&item.PriceType,
			&item.PriceValue,
			&item.IsDefault,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		item.SKU = fromNullString(sku)
		item.SwatchHex = fromNullString(swatchHex)
		values = append(values, item)
	}
	return values, nil
}

func listCustomOptionValues(ctx context.Context, q queryable, optionID string) ([]ProductCustomOptionValue, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT id, option_id, title, sku, sort_order, swatch_hex, price_type, price_value, is_default, created_at, updated_at
		FROM product_custom_option_values
		WHERE option_id = $1::uuid
		ORDER BY sort_order ASC, id ASC
	`, optionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]ProductCustomOptionValue, 0, 8)
	for rows.Next() {
		var item ProductCustomOptionValue
		var sku sql.NullString
		var swatchHex sql.NullString
		if err := rows.Scan(
			&item.ID,
			&item.OptionID,
			&item.Title,
			&sku,
			&item.SortOrder,
			&swatchHex,
			&item.PriceType,
			&item.PriceValue,
			&item.IsDefault,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.SKU = fromNullString(sku)
		item.SwatchHex = fromNullString(swatchHex)
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

type customOptionScanner interface {
	Scan(dest ...any) error
}

type queryable interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

func scanCustomOption(scanner customOptionScanner) (ProductCustomOption, error) {
	var (
		item      ProductCustomOption
		storeID   sql.NullString
		priceType sql.NullString
		priceVal  sql.NullFloat64
	)
	if err := scanner.Scan(
		&item.ID,
		&storeID,
		&item.Code,
		&item.Title,
		&item.TypeGroup,
		&item.Type,
		&item.Required,
		&item.SortOrder,
		&item.DisplayMode,
		&priceType,
		&priceVal,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return ProductCustomOption{}, err
	}
	item.StoreID = fromNullString(storeID)
	item.PriceType = fromNullString(priceType)
	item.PriceValue = fromNullFloat64(priceVal)
	return item, nil
}

func fromNullString(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	s := v.String
	return &s
}

func normalizeOptionalTrimmedString(v *string) *string {
	if v == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*v)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func toNullFloat64(v *float64) sql.NullFloat64 {
	if v == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *v, Valid: true}
}

func fromNullFloat64(v sql.NullFloat64) *float64 {
	if !v.Valid {
		return nil
	}
	f := v.Float64
	return &f
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23503"
}
