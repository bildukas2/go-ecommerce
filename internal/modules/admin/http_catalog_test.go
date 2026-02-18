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
	listAdminCategoriesFn   func(context.Context) ([]storcat.AdminCategory, error)
	updateCategoryFn        func(context.Context, string, storcat.CategoryUpsertInput) (storcat.Category, error)
	deleteCategoryFn        func(context.Context, string) (storcat.DeleteCategoryResult, error)
	createProductFn         func(context.Context, storcat.ProductUpsertInput) (storcat.Product, error)
	createProductVariantFn  func(context.Context, string, storcat.ProductVariantCreateInput) (storcat.Variant, error)
	updateProductFn         func(context.Context, string, storcat.ProductUpsertInput) (storcat.Product, error)
	replaceProductCatsFn    func(context.Context, string, []string) error
	bulkAssignProductCatsFn func(context.Context, []string, []string) (int64, error)
	bulkRemoveProductCatsFn func(context.Context, []string, []string) (int64, error)
	applyDiscountProductsFn func(context.Context, []string, storcat.ProductDiscountInput) (int64, error)
	listCustomOptionsFn     func(context.Context, storcat.ListCustomOptionsParams) ([]storcat.ProductCustomOption, error)
	createCustomOptionFn    func(context.Context, storcat.CustomOptionUpsertInput) (storcat.ProductCustomOption, error)
	getCustomOptionByIDFn   func(context.Context, string) (storcat.ProductCustomOption, error)
	updateCustomOptionFn    func(context.Context, string, storcat.CustomOptionUpsertInput) (storcat.ProductCustomOption, error)
	deleteCustomOptionFn    func(context.Context, string) error
	listAssignmentsFn       func(context.Context, string) ([]storcat.ProductCustomOptionAssignment, error)
	attachAssignmentFn      func(context.Context, string, string, *int) (storcat.ProductCustomOptionAssignment, error)
	detachAssignmentFn      func(context.Context, string, string) error
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
func (f *fakeCatalogStore) ListAdminCategories(ctx context.Context) ([]storcat.AdminCategory, error) {
	if f.listAdminCategoriesFn == nil {
		return []storcat.AdminCategory{}, nil
	}
	return f.listAdminCategoriesFn(ctx)
}
func (f *fakeCatalogStore) DeleteCategory(ctx context.Context, id string) (storcat.DeleteCategoryResult, error) {
	if f.deleteCategoryFn == nil {
		return storcat.DeleteCategoryResult{}, nil
	}
	return f.deleteCategoryFn(ctx, id)
}
func (f *fakeCatalogStore) CreateProduct(ctx context.Context, in storcat.ProductUpsertInput) (storcat.Product, error) {
	if f.createProductFn == nil {
		return storcat.Product{}, nil
	}
	return f.createProductFn(ctx, in)
}
func (f *fakeCatalogStore) CreateProductVariant(ctx context.Context, productID string, in storcat.ProductVariantCreateInput) (storcat.Variant, error) {
	if f.createProductVariantFn == nil {
		return storcat.Variant{}, nil
	}
	return f.createProductVariantFn(ctx, productID, in)
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
func (f *fakeCatalogStore) ListCustomOptions(ctx context.Context, in storcat.ListCustomOptionsParams) ([]storcat.ProductCustomOption, error) {
	if f.listCustomOptionsFn == nil {
		return []storcat.ProductCustomOption{}, nil
	}
	return f.listCustomOptionsFn(ctx, in)
}
func (f *fakeCatalogStore) CreateCustomOption(ctx context.Context, in storcat.CustomOptionUpsertInput) (storcat.ProductCustomOption, error) {
	if f.createCustomOptionFn == nil {
		return storcat.ProductCustomOption{}, nil
	}
	return f.createCustomOptionFn(ctx, in)
}
func (f *fakeCatalogStore) GetCustomOptionByID(ctx context.Context, id string) (storcat.ProductCustomOption, error) {
	if f.getCustomOptionByIDFn == nil {
		return storcat.ProductCustomOption{}, nil
	}
	return f.getCustomOptionByIDFn(ctx, id)
}
func (f *fakeCatalogStore) UpdateCustomOption(ctx context.Context, id string, in storcat.CustomOptionUpsertInput) (storcat.ProductCustomOption, error) {
	if f.updateCustomOptionFn == nil {
		return storcat.ProductCustomOption{}, nil
	}
	return f.updateCustomOptionFn(ctx, id, in)
}
func (f *fakeCatalogStore) DeleteCustomOption(ctx context.Context, id string) error {
	if f.deleteCustomOptionFn == nil {
		return nil
	}
	return f.deleteCustomOptionFn(ctx, id)
}
func (f *fakeCatalogStore) ListProductCustomOptionAssignments(ctx context.Context, productID string) ([]storcat.ProductCustomOptionAssignment, error) {
	if f.listAssignmentsFn == nil {
		return []storcat.ProductCustomOptionAssignment{}, nil
	}
	return f.listAssignmentsFn(ctx, productID)
}
func (f *fakeCatalogStore) AttachProductCustomOption(ctx context.Context, productID, optionID string, sortOrder *int) (storcat.ProductCustomOptionAssignment, error) {
	if f.attachAssignmentFn == nil {
		return storcat.ProductCustomOptionAssignment{}, nil
	}
	return f.attachAssignmentFn(ctx, productID, optionID, sortOrder)
}
func (f *fakeCatalogStore) DetachProductCustomOption(ctx context.Context, productID, optionID string) error {
	if f.detachAssignmentFn == nil {
		return nil
	}
	return f.detachAssignmentFn(ctx, productID, optionID)
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

func TestCatalogDeleteCategorySuccess(t *testing.T) {
	store := &fakeCatalogStore{
		deleteCategoryFn: func(_ context.Context, id string) (storcat.DeleteCategoryResult, error) {
			if id != "cat-1" {
				t.Fatalf("unexpected id: %s", id)
			}
			return storcat.DeleteCategoryResult{
				DeletedCategoryID:   "cat-1",
				DeletedCategorySlug: "apparel",
				AffectedProducts:    5,
				ReassignedProducts:  2,
				FallbackCategory:    "uncategorized",
			}, nil
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodDelete, "/admin/catalog/categories/cat-1", nil)
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte("admin:pass")))
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["affected_products"] != float64(5) {
		t.Fatalf("unexpected response payload: %#v", payload)
	}
}

func TestCatalogDeleteCategoryMapsNotFound(t *testing.T) {
	store := &fakeCatalogStore{
		deleteCategoryFn: func(_ context.Context, _ string) (storcat.DeleteCategoryResult, error) {
			return storcat.DeleteCategoryResult{}, storcat.ErrNotFound
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodDelete, "/admin/catalog/categories/cat-1", nil)
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte("admin:pass")))
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
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

func TestCatalogCreateProductVariantSuccess(t *testing.T) {
	store := &fakeCatalogStore{
		createProductVariantFn: func(_ context.Context, productID string, in storcat.ProductVariantCreateInput) (storcat.Variant, error) {
			if productID != "prod-1" {
				t.Fatalf("unexpected product id: %s", productID)
			}
			if in.SKU != "SKU-1" || in.PriceCents != 1999 || in.Stock != 10 {
				t.Fatalf("unexpected input: %#v", in)
			}
			return storcat.Variant{ID: "var-1", SKU: in.SKU, PriceCents: in.PriceCents, Currency: in.Currency, Stock: in.Stock}, nil
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"sku":         "SKU-1",
		"price_cents": 1999,
		"stock":       10,
		"currency":    "USD",
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/catalog/products/prod-1/variants", body)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, res.Code)
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
