package admin

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	storcat "goecommerce/internal/storage/catalog"
)

type fakeCatalogStore struct {
	createCategoryFn        func(context.Context, storcat.CategoryUpsertInput) (storcat.Category, error)
	updateCategoryFn        func(context.Context, string, storcat.CategoryUpsertInput) (storcat.Category, error)
	createProductFn         func(context.Context, storcat.ProductUpsertInput) (storcat.Product, error)
	updateProductFn         func(context.Context, string, storcat.ProductUpsertInput) (storcat.Product, error)
	replaceProductCatsFn    func(context.Context, string, []string) error
	bulkAssignProductCatsFn func(context.Context, []string, []string) (int64, error)
	bulkRemoveProductCatsFn func(context.Context, []string, []string) (int64, error)
	applyDiscountProductsFn func(context.Context, []string, storcat.ProductDiscountInput) (int64, error)
}

func (f *fakeCatalogStore) CreateCategory(ctx context.Context, in storcat.CategoryUpsertInput) (storcat.Category, error) {
	if f.createCategoryFn == nil {
		return storcat.Category{}, nil
	}
	return f.createCategoryFn(ctx, in)
}
func (f *fakeCatalogStore) UpdateCategory(ctx context.Context, id string, in storcat.CategoryUpsertInput) (storcat.Category, error) {
	if f.updateCategoryFn == nil {
		return storcat.Category{}, nil
	}
	return f.updateCategoryFn(ctx, id, in)
}
func (f *fakeCatalogStore) CreateProduct(ctx context.Context, in storcat.ProductUpsertInput) (storcat.Product, error) {
	if f.createProductFn == nil {
		return storcat.Product{}, nil
	}
	return f.createProductFn(ctx, in)
}
func (f *fakeCatalogStore) UpdateProduct(ctx context.Context, id string, in storcat.ProductUpsertInput) (storcat.Product, error) {
	if f.updateProductFn == nil {
		return storcat.Product{}, nil
	}
	return f.updateProductFn(ctx, id, in)
}
func (f *fakeCatalogStore) ReplaceProductCategories(ctx context.Context, productID string, categoryIDs []string) error {
	if f.replaceProductCatsFn == nil {
		return nil
	}
	return f.replaceProductCatsFn(ctx, productID, categoryIDs)
}
func (f *fakeCatalogStore) BulkAssignProductCategories(ctx context.Context, productIDs []string, categoryIDs []string) (int64, error) {
	if f.bulkAssignProductCatsFn == nil {
		return 0, nil
	}
	return f.bulkAssignProductCatsFn(ctx, productIDs, categoryIDs)
}
func (f *fakeCatalogStore) BulkRemoveProductCategories(ctx context.Context, productIDs []string, categoryIDs []string) (int64, error) {
	if f.bulkRemoveProductCatsFn == nil {
		return 0, nil
	}
	return f.bulkRemoveProductCatsFn(ctx, productIDs, categoryIDs)
}
func (f *fakeCatalogStore) ApplyDiscountToProducts(ctx context.Context, productIDs []string, in storcat.ProductDiscountInput) (int64, error) {
	if f.applyDiscountProductsFn == nil {
		return 0, nil
	}
	return f.applyDiscountProductsFn(ctx, productIDs, in)
}

func TestCatalogCreateCategorySuccess(t *testing.T) {
	store := &fakeCatalogStore{
		createCategoryFn: func(_ context.Context, in storcat.CategoryUpsertInput) (storcat.Category, error) {
			if in.Slug != "new-category" {
				t.Fatalf("unexpected slug: %s", in.Slug)
			}
			return storcat.Category{
				ID:          "cat-1",
				Slug:        in.Slug,
				Name:        in.Name,
				Description: in.Description,
			}, nil
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"slug":              "new-category",
		"name":              "New Category",
		"description":       "Description",
		"default_image_url": "https://images.example.com/cat.jpg",
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/catalog/categories", body)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, res.Code)
	}
}

func TestCatalogCreateCategoryValidationError(t *testing.T) {
	m := &module{catalog: &fakeCatalogStore{}, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"slug": "Bad Slug",
		"name": "Category",
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/catalog/categories", body)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func TestCatalogBulkAssignCategoriesMapsNotFound(t *testing.T) {
	store := &fakeCatalogStore{
		bulkAssignProductCatsFn: func(_ context.Context, productIDs []string, categoryIDs []string) (int64, error) {
			if len(productIDs) != 1 || len(categoryIDs) != 1 {
				t.Fatalf("unexpected ids")
			}
			return 0, storcat.ErrNotFound
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"product_ids":  []string{"prod-1"},
		"category_ids": []string{"cat-1"},
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/catalog/products/categories/bulk-assign", body)
	if res.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, res.Code)
	}
}

func TestCatalogProductDiscountValidationError(t *testing.T) {
	m := &module{catalog: &fakeCatalogStore{}, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"mode": "percent",
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/catalog/products/prod-1/discount", body)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func TestCatalogProductDiscountSuccess(t *testing.T) {
	store := &fakeCatalogStore{
		applyDiscountProductsFn: func(_ context.Context, productIDs []string, in storcat.ProductDiscountInput) (int64, error) {
			if len(productIDs) != 1 || productIDs[0] != "prod-1" {
				t.Fatalf("unexpected product ids: %#v", productIDs)
			}
			if in.Mode != storcat.DiscountModePrice || in.DiscountPriceCents == nil || *in.DiscountPriceCents != 900 {
				t.Fatalf("unexpected discount input: %#v", in)
			}
			return 3, nil
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"mode":                 "price",
		"discount_price_cents": 900,
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/catalog/products/prod-1/discount", body)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["updated_variants"] != float64(3) {
		t.Fatalf("unexpected response payload: %#v", payload)
	}
}

func performAdminJSONRequest(t *testing.T, h http.Handler, method, path string, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte("admin:pass")))
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)
	return res
}
