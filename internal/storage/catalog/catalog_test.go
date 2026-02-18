package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

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
			Description:     "Apparel category",
			ParentID:        sql.NullString{String: "parent-1", Valid: true},
			DefaultImageURL: sql.NullString{String: "https://images.example.com/apparel.jpg", Valid: true},
			SEOTitle:        sql.NullString{String: "Apparel SEO", Valid: true},
			SEODescription:  sql.NullString{String: "Shop all apparel", Valid: true},
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
		if out["description"] != "Apparel category" {
			t.Fatalf("expected description to be set, got %#v", out["description"])
		}
		if out["seoTitle"] != "Apparel SEO" {
			t.Fatalf("expected seoTitle to be set, got %#v", out["seoTitle"])
		}
		if out["seoDescription"] != "Shop all apparel" {
			t.Fatalf("expected seoDescription to be set, got %#v", out["seoDescription"])
		}
	})

	t.Run("without values", func(t *testing.T) {
		c := Category{
			ID:              "cat-1",
			Slug:            "apparel",
			Name:            "Apparel",
			Description:     "",
			ParentID:        sql.NullString{Valid: false},
			DefaultImageURL: sql.NullString{Valid: false},
			SEOTitle:        sql.NullString{Valid: false},
			SEODescription:  sql.NullString{Valid: false},
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
		if out["seoTitle"] != nil {
			t.Fatalf("expected seoTitle null, got %#v", out["seoTitle"])
		}
		if out["seoDescription"] != nil {
			t.Fatalf("expected seoDescription null, got %#v", out["seoDescription"])
		}
	})
}

func TestProductAndVariantMarshalJSONIncludesSEOAndCompareAt(t *testing.T) {
	seoTitle := "Basic Tee SEO"
	seoDescription := "Soft cotton tee"
	compareAt := 2000

	product := Product{
		ID:             "prod-1",
		Slug:           "basic-tee",
		Title:          "Basic Tee",
		Description:    "Everyday tee",
		SEOTitle:       &seoTitle,
		SEODescription: &seoDescription,
		Variants: []Variant{
			{
				ID:                  "var-1",
				SKU:                 "TEE-S",
				PriceCents:          1500,
				CompareAtPriceCents: &compareAt,
				Currency:            "EUR",
				Stock:               10,
				Attributes:          map[string]interface{}{"size": "S"},
			},
		},
		Images: []Image{{ID: "img-1", URL: "https://images.example.com/tee.jpg", Alt: "tee", Sort: 1, IsDefault: true}},
	}

	raw, err := json.Marshal(product)
	if err != nil {
		t.Fatalf("marshal product: %v", err)
	}

	var out map[string]interface{}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal product json: %v", err)
	}

	if out["seoTitle"] != seoTitle {
		t.Fatalf("expected seoTitle %q, got %#v", seoTitle, out["seoTitle"])
	}
	if out["seoDescription"] != seoDescription {
		t.Fatalf("expected seoDescription %q, got %#v", seoDescription, out["seoDescription"])
	}

	variantsRaw, ok := out["variants"].([]interface{})
	if !ok || len(variantsRaw) != 1 {
		t.Fatalf("expected one variant in output, got %#v", out["variants"])
	}
	variantOut, ok := variantsRaw[0].(map[string]interface{})
	if !ok {
		t.Fatalf("expected variant object, got %#v", variantsRaw[0])
	}
	if variantOut["compareAtPriceCents"] != float64(compareAt) {
		t.Fatalf("expected compareAtPriceCents %d, got %#v", compareAt, variantOut["compareAtPriceCents"])
	}
}

func TestImageMarshalJSONIncludesIsDefault(t *testing.T) {
	t.Run("true", func(t *testing.T) {
		img := Image{
			ID:        "img-1",
			URL:       "https://images.example.com/default.jpg",
			Alt:       "Default image",
			Sort:      1,
			IsDefault: true,
		}

		raw, err := json.Marshal(img)
		if err != nil {
			t.Fatalf("marshal image: %v", err)
		}

		var out map[string]interface{}
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatalf("unmarshal image json: %v", err)
		}

		if out["isDefault"] != true {
			t.Fatalf("expected isDefault true, got %#v", out["isDefault"])
		}
	})

	t.Run("false", func(t *testing.T) {
		img := Image{
			ID:        "img-2",
			URL:       "https://images.example.com/other.jpg",
			Alt:       "Other image",
			Sort:      2,
			IsDefault: false,
		}

		raw, err := json.Marshal(img)
		if err != nil {
			t.Fatalf("marshal image: %v", err)
		}

		var out map[string]interface{}
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatalf("unmarshal image json: %v", err)
		}

		if out["isDefault"] != false {
			t.Fatalf("expected isDefault false, got %#v", out["isDefault"])
		}
	})
}

func TestProductVariantCompareAtPriceConstraint(t *testing.T) {
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

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx error: %v", err)
	}
	defer tx.Rollback()

	suffix := time.Now().UnixNano()
	productSlug := fmt.Sprintf("discount-test-%d", suffix)
	skuOK := fmt.Sprintf("SKU-OK-%d", suffix)
	skuBad := fmt.Sprintf("SKU-BAD-%d", suffix)

	var productID string
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO products (slug, title, description)
		VALUES ($1, $2, $3)
		RETURNING id
	`, productSlug, "Discount Test Product", "tmp").Scan(&productID); err != nil {
		t.Fatalf("insert product: %v", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO product_variants (product_id, sku, price_cents, compare_at_price_cents, currency, stock, attributes_json)
		VALUES ($1, $2, 1000, 1200, 'EUR', 1, '{}'::jsonb)
	`, productID, skuOK); err != nil {
		t.Fatalf("expected valid compare_at insert to succeed: %v", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO product_variants (product_id, sku, price_cents, compare_at_price_cents, currency, stock, attributes_json)
		VALUES ($1, $2, 1000, 900, 'EUR', 1, '{}'::jsonb)
	`, productID, skuBad); err == nil {
		t.Fatalf("expected compare_at < price insert to fail")
	}
}
