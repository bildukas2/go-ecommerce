package catalog

import (
	"context"
	"errors"
	"testing"
)

func TestDeleteProductSuccess(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	ctx := context.Background()
	productID := createProductForCustomOptionTest(t, store.db)

	if err := store.DeleteProduct(ctx, productID); err != nil {
		t.Fatalf("delete product: %v", err)
	}

	var count int
	if err := store.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM products WHERE id = $1::uuid`, productID).Scan(&count); err != nil {
		t.Fatalf("count product: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected deleted product count 0, got %d", count)
	}
}

func TestDeleteProductReturnsNotFound(t *testing.T) {
	store, cleanup := openCatalogStoreForCustomOptionTests(t)
	defer cleanup()

	err := store.DeleteProduct(context.Background(), "00000000-0000-0000-0000-000000000001")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}
