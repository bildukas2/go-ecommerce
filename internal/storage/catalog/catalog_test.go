package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"testing"

	platformdb "goecommerce/internal/platform/db"
)

func TestDBConnectSimpleQuery(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping wiring test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()
	var one int
	if err := db.QueryRowContext(ctx, "SELECT 1").Scan(&one); err != nil {
		t.Fatalf("simple query failed: %v", err)
	}
	if one != 1 {
		t.Fatalf("unexpected result: %d", one)
	}
}

func TestGetProductBySlugIncludesVariantsAndImages(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}
	defer store.Close()

	product, err := store.GetProductBySlug(ctx, "basic-tee")
	if err != nil {
		t.Fatalf("get product error: %v", err)
	}
	if product.Slug != "basic-tee" {
		t.Fatalf("unexpected slug: %s", product.Slug)
	}
	if len(product.Variants) == 0 {
		t.Fatalf("expected variants for seeded product")
	}
	if len(product.Images) == 0 {
		t.Fatalf("expected images for seeded product")
	}
	if product.Variants[0].ID == "" {
		t.Fatalf("expected variant id")
	}
	if product.Images[0].URL == "" {
		t.Fatalf("expected image url")
	}
	if len(product.Variants[0].Attributes) == 0 {
		t.Fatalf("expected attributes for seeded product")
	}
}

func TestListProductsIncludesVariantsAndImages(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new store error: %v", err)
	}
	defer store.Close()

	res, err := store.ListProducts(ctx, ListProductsParams{
		Pagination: Pagination{Page: 1, Limit: 10},
	})
	if err != nil {
		t.Fatalf("list products error: %v", err)
	}

	if len(res.Items) == 0 {
		t.Skip("no products found in database; cannot verify variants/images")
	}

	foundWithVariants := false
	foundWithImages := false

	for _, p := range res.Items {
		if len(p.Variants) > 0 {
			foundWithVariants = true
		}
		if len(p.Images) > 0 {
			foundWithImages = true
		}
	}

	if !foundWithVariants {
		t.Error("expected at least one product in list to have variants")
	}
	if !foundWithImages {
		t.Error("expected at least one product in list to have images")
	}
}

func TestCategoryMarshalJSONIncludesDefaultImageURL(t *testing.T) {
	t.Run("with values", func(t *testing.T) {
		c := Category{
			ID:              "cat-1",
			Slug:            "apparel",
			Name:            "Apparel",
			ParentID:        sql.NullString{String: "parent-1", Valid: true},
			DefaultImageURL: sql.NullString{String: "https://images.example.com/apparel.jpg", Valid: true},
		}

		raw, err := json.Marshal(c)
		if err != nil {
			t.Fatalf("marshal category: %v", err)
		}

		var out map[string]interface{}
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatalf("unmarshal category json: %v", err)
		}

		if out["parentId"] != "parent-1" {
			t.Fatalf("expected parentId parent-1, got %#v", out["parentId"])
		}
		if out["defaultImageUrl"] != "https://images.example.com/apparel.jpg" {
			t.Fatalf("expected defaultImageUrl to be set, got %#v", out["defaultImageUrl"])
		}
	})

	t.Run("without values", func(t *testing.T) {
		c := Category{
			ID:              "cat-1",
			Slug:            "apparel",
			Name:            "Apparel",
			ParentID:        sql.NullString{Valid: false},
			DefaultImageURL: sql.NullString{Valid: false},
		}

		raw, err := json.Marshal(c)
		if err != nil {
			t.Fatalf("marshal category: %v", err)
		}

		var out map[string]interface{}
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatalf("unmarshal category json: %v", err)
		}

		if out["parentId"] != nil {
			t.Fatalf("expected parentId null, got %#v", out["parentId"])
		}
		if out["defaultImageUrl"] != nil {
			t.Fatalf("expected defaultImageUrl null, got %#v", out["defaultImageUrl"])
		}
	})
}
