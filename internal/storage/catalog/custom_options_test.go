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
	defer deleteOptionByID(t, store.db, option.ID)

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
	defer deleteOptionByID(t, store.db, option.ID)

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
