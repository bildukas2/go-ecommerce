package catalog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	platformdb "goecommerce/internal/platform/db"
)

func TestCreateCustomOptionSelectRequiresValues(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	_, err := store.CreateCustomOption(context.Background(), CustomOptionUpsertInput{
		Code:      uniqueCode("select-no-values"),
		Title:     "Gift Message",
		TypeGroup: CustomOptionTypeGroupSelect,
		Type:      "dropdown",
		IsActive:  boolPtr(true),
	})
	if err == nil {
		t.Fatalf("expected error for select option without values")
	}
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestCreateCustomOptionNonSelectRejectsValues(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	valuePrice := 5.0
	optionPrice := 1.0
	_, err := store.CreateCustomOption(context.Background(), CustomOptionUpsertInput{
		Code:       uniqueCode("text-with-values"),
		Title:      "Engraving",
		TypeGroup:  CustomOptionTypeGroupText,
		Type:       "field",
		PriceType:  stringPtr(CustomOptionPriceTypeFixed),
		PriceValue: &optionPrice,
		IsActive:   boolPtr(true),
		Values: []CustomOptionValueUpsertInput{
			{
				Title:      "Line 1",
				PriceType:  CustomOptionPriceTypeFixed,
				PriceValue: &valuePrice,
			},
		},
	})
	if err == nil {
		t.Fatalf("expected error for non-select option with values")
	}
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestDeleteCustomOptionBlockedWhenAssigned(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	ctx := context.Background()
	productID := createProductForCustomOptionTest(t, store.db)
	defer deleteProductByID(t, store.db, productID)

	priceValue := 0.0
	option, err := store.CreateCustomOption(ctx, CustomOptionUpsertInput{
		Code:       uniqueCode("delete-guard"),
		Title:      "Gift Wrap",
		TypeGroup:  CustomOptionTypeGroupText,
		Type:       "field",
		PriceType:  stringPtr(CustomOptionPriceTypeFixed),
		PriceValue: &priceValue,
		IsActive:   boolPtr(true),
	})
	if err != nil {
		t.Fatalf("create option: %v", err)
	}

	if _, err := store.AttachProductCustomOption(ctx, productID, option.ID, nil); err != nil {
		t.Fatalf("attach option: %v", err)
	}

	err = store.DeleteCustomOption(ctx, option.ID)
	if err == nil {
		t.Fatalf("expected delete to fail for assigned option")
	}
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
}

func TestAttachProductCustomOptionUniqueness(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	ctx := context.Background()
	productID := createProductForCustomOptionTest(t, store.db)
	defer deleteProductByID(t, store.db, productID)

	priceValue := 0.0
	option, err := store.CreateCustomOption(ctx, CustomOptionUpsertInput{
		Code:       uniqueCode("assignment-unique"),
		Title:      "Personal Note",
		TypeGroup:  CustomOptionTypeGroupText,
		Type:       "field",
		PriceType:  stringPtr(CustomOptionPriceTypeFixed),
		PriceValue: &priceValue,
		IsActive:   boolPtr(true),
	})
	if err != nil {
		t.Fatalf("create option: %v", err)
	}

	if _, err := store.AttachProductCustomOption(ctx, productID, option.ID, nil); err != nil {
		t.Fatalf("first attach: %v", err)
	}

	_, err = store.AttachProductCustomOption(ctx, productID, option.ID, nil)
	if err == nil {
		t.Fatalf("expected second attach to fail with unique conflict")
	}
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
}

func TestCreateCustomOptionInvalidDisplayMode(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	valuePrice := 0.0
	_, err := store.CreateCustomOption(context.Background(), CustomOptionUpsertInput{
		Code:        uniqueCode("invalid-display-mode"),
		Title:       "Size",
		TypeGroup:   CustomOptionTypeGroupSelect,
		Type:        "dropdown",
		DisplayMode: "invalid_mode",
		IsActive:    boolPtr(true),
		Values: []CustomOptionValueUpsertInput{
			{
				Title:      "S",
				PriceType:  CustomOptionPriceTypeFixed,
				PriceValue: &valuePrice,
			},
		},
	})
	if err == nil {
		t.Fatalf("expected error for invalid display_mode")
	}
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestCreateCustomOptionDisplayModeOnlyForSelect(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	priceValue := 0.0
	_, err := store.CreateCustomOption(context.Background(), CustomOptionUpsertInput{
		Code:        uniqueCode("buttons-on-text"),
		Title:       "Custom Text",
		TypeGroup:   CustomOptionTypeGroupText,
		Type:        "field",
		DisplayMode: "buttons",
		PriceType:   stringPtr(CustomOptionPriceTypeFixed),
		PriceValue:  &priceValue,
		IsActive:    boolPtr(true),
	})
	if err == nil {
		t.Fatalf("expected error for display_mode on non-select option")
	}
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestCreateCustomOptionValidDisplayModes(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	ctx := context.Background()
	displayModes := []string{"default", "buttons", "color_buttons"}

	for _, displayMode := range displayModes {
		valuePrice := 0.0
		option, err := store.CreateCustomOption(ctx, CustomOptionUpsertInput{
			Code:        uniqueCode(fmt.Sprintf("test-%s", displayMode)),
			Title:       fmt.Sprintf("Option %s", displayMode),
			TypeGroup:   CustomOptionTypeGroupSelect,
			Type:        "dropdown",
			DisplayMode: displayMode,
			IsActive:    boolPtr(true),
			Values: []CustomOptionValueUpsertInput{
				{
					Title:      "Value 1",
					PriceType:  CustomOptionPriceTypeFixed,
					PriceValue: &valuePrice,
				},
			},
		})
		if err != nil {
			t.Fatalf("create option with display_mode=%s: %v", displayMode, err)
		}
		defer deleteOptionByID(t, store.db, option.ID)

		if option.DisplayMode != displayMode {
			t.Fatalf("expected display_mode=%s, got %s", displayMode, option.DisplayMode)
		}
	}
}

func TestCreateCustomOptionInvalidSwatchHex(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	invalidHexValues := []string{
		"#GGG000",   // invalid hex chars
		"#FF0000FF", // too long
		"#FF00",     // too short
		"FF0000",    // missing #
		"#FF000Z",   // invalid char Z
	}

	for _, hexValue := range invalidHexValues {
		valuePrice := 0.0
		_, err := store.CreateCustomOption(context.Background(), CustomOptionUpsertInput{
			Code:        uniqueCode("invalid-hex"),
			Title:       "Color Option",
			TypeGroup:   CustomOptionTypeGroupSelect,
			Type:        "dropdown",
			DisplayMode: "color_buttons",
			IsActive:    boolPtr(true),
			Values: []CustomOptionValueUpsertInput{
				{
					Title:      "Red",
					SwatchHex:  stringPtr(hexValue),
					PriceType:  CustomOptionPriceTypeFixed,
					PriceValue: &valuePrice,
				},
			},
		})
		if err == nil {
			t.Fatalf("expected error for invalid swatch_hex=%s", hexValue)
		}
		if !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput for hex=%s, got %v", hexValue, err)
		}
	}
}

func TestCreateCustomOptionValidSwatchHex(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	ctx := context.Background()
	validHexValues := []string{"#FF0000", "#00FF00", "#0000FF", "#111827", "#F9FAFB"}

	for _, hexValue := range validHexValues {
		valuePrice := 0.0
		option, err := store.CreateCustomOption(ctx, CustomOptionUpsertInput{
			Code:        uniqueCode(fmt.Sprintf("valid-hex-%s", hexValue)),
			Title:       "Color Option",
			TypeGroup:   CustomOptionTypeGroupSelect,
			Type:        "dropdown",
			DisplayMode: "color_buttons",
			IsActive:    boolPtr(true),
			Values: []CustomOptionValueUpsertInput{
				{
					Title:      "Color",
					SwatchHex:  stringPtr(hexValue),
					PriceType:  CustomOptionPriceTypeFixed,
					PriceValue: &valuePrice,
				},
			},
		})
		if err != nil {
			t.Fatalf("create option with valid swatch_hex=%s: %v", hexValue, err)
		}
		defer deleteOptionByID(t, store.db, option.ID)

		if len(option.Values) == 0 {
			t.Fatalf("expected at least one value")
		}
		if option.Values[0].SwatchHex == nil || *option.Values[0].SwatchHex != hexValue {
			t.Fatalf("expected swatch_hex=%s, got %v", hexValue, option.Values[0].SwatchHex)
		}
	}
}

func TestCreateCustomOptionNullSwatchHex(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	ctx := context.Background()
	valuePrice := 0.0
	option, err := store.CreateCustomOption(ctx, CustomOptionUpsertInput{
		Code:        uniqueCode("null-swatch"),
		Title:       "Color Option",
		TypeGroup:   CustomOptionTypeGroupSelect,
		Type:        "dropdown",
		DisplayMode: "color_buttons",
		IsActive:    boolPtr(true),
		Values: []CustomOptionValueUpsertInput{
			{
				Title:      "No Color",
				SwatchHex:  nil,
				PriceType:  CustomOptionPriceTypeFixed,
				PriceValue: &valuePrice,
			},
		},
	})
	if err != nil {
		t.Fatalf("create option with null swatch_hex: %v", err)
	}
	defer deleteOptionByID(t, store.db, option.ID)

	if len(option.Values) == 0 {
		t.Fatalf("expected at least one value")
	}
	if option.Values[0].SwatchHex != nil {
		t.Fatalf("expected swatch_hex=nil, got %v", option.Values[0].SwatchHex)
	}
}

func openCatalogStoreForCustomOptionTests(t *testing.T) (*Store, func()) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}

	if !customOptionsTablesPresent(ctx, t, db) {
		_ = db.Close()
		t.Skip("custom options tables not present; apply migrations to run this test")
	}

	store, err := NewStore(ctx, db)
	if err != nil {
		_ = db.Close()
		t.Fatalf("new store error: %v", err)
	}

	return store, func() {
		_ = store.Close()
		_ = db.Close()
	}
}

func customOptionsTablesPresent(ctx context.Context, t *testing.T, db *sql.DB) bool {
	t.Helper()
	var tableName *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public.product_custom_options')").Scan(&tableName); err != nil {
		t.Fatalf("check table presence: %v", err)
	}
	return tableName != nil && *tableName != ""
}

func createProductForCustomOptionTest(t *testing.T, db *sql.DB) string {
	t.Helper()
	suffix := time.Now().UnixNano()
	slug := fmt.Sprintf("custom-option-product-%d", suffix)
	var productID string
	if err := db.QueryRowContext(context.Background(), `
		INSERT INTO products (slug, title, description, status, tags)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, slug, "Custom Option Product", "test", "published", []string{}).Scan(&productID); err != nil {
		t.Fatalf("insert product: %v", err)
	}
	return productID
}

func deleteProductByID(t *testing.T, db *sql.DB, productID string) {
	t.Helper()
	if productID == "" {
		return
	}
	if _, err := db.ExecContext(context.Background(), `DELETE FROM products WHERE id = $1::uuid`, productID); err != nil {
		t.Fatalf("delete product: %v", err)
	}
}

func deleteOptionByID(t *testing.T, db execer, optionID string) {
	t.Helper()
	if optionID == "" {
		return
	}
	if _, err := db.ExecContext(context.Background(), `DELETE FROM product_custom_options WHERE id = $1::uuid`, optionID); err != nil {
		t.Fatalf("delete option: %v", err)
	}
}

type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func uniqueCode(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func boolPtr(v bool) *bool {
	return &v
}

func stringPtr(v string) *string {
	return &v
}
