package admin

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"

	"goecommerce/internal/app"
	platformhttp "goecommerce/internal/platform/http"
	storcat "goecommerce/internal/storage/catalog"
	storcustomers "goecommerce/internal/storage/customers"
	stormedia "goecommerce/internal/storage/media"
	stororders "goecommerce/internal/storage/orders"
)

type module struct {
	orders              ordersStore
	customers           customersStore
	catalog             catalogStore
	media               mediaStore
	validateImportHost  func(context.Context, string) error
	downloadImportImage func(context.Context, string) ([]byte, string, error)
	uploadsDir          string
	user                string
	pass                string
}

func NewModule(deps app.Deps) app.Module {
	var ost ordersStore
	if deps.DB != nil {
		if s, err := stororders.NewStore(context.Background(), deps.DB); err == nil {
			ost = s
		}
	}
	var cust customersStore
	if deps.DB != nil {
		if s, err := storcustomers.NewStore(context.Background(), deps.DB); err == nil {
			cust = s
		}
	}
	var cst catalogStore
	if deps.DB != nil {
		if s, err := storcat.NewStore(context.Background(), deps.DB); err == nil {
			cst = s
		}
	}
	var mst mediaStore
	if deps.DB != nil {
		if s, err := stormedia.NewStore(context.Background(), deps.DB); err == nil {
			mst = s
		}
	}
	uploadsDir := strings.TrimSpace(os.Getenv("UPLOADS_DIR"))
	if uploadsDir == "" {
		uploadsDir = "./tmp/uploads"
	}
	_ = os.MkdirAll(uploadsDir, 0o755)
	return &module{
		orders:     ost,
		customers:  cust,
		catalog:    cst,
		media:      mst,
		uploadsDir: uploadsDir,
		user:       strings.TrimSpace(os.Getenv("ADMIN_USER")),
		pass:       strings.TrimSpace(os.Getenv("ADMIN_PASS")),
	}
}

func (m *module) Close() error {
	if m.orders != nil {
		if closer, ok := m.orders.(interface{ Close() error }); ok {
			_ = closer.Close()
		}
	}
	if m.customers != nil {
		if closer, ok := m.customers.(interface{ Close() error }); ok {
			_ = closer.Close()
		}
	}
	if m.catalog != nil {
		if closer, ok := m.catalog.(interface{ Close() error }); ok {
			_ = closer.Close()
		}
	}
	if m.media != nil {
		if closer, ok := m.media.(interface{ Close() error }); ok {
			_ = closer.Close()
		}
	}
	return nil
}

func (m *module) Name() string { return "admin" }

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/admin/dashboard", m.wrapAuth(m.handleDashboard))
	mux.HandleFunc("/admin/orders", m.wrapAuth(m.handleOrders))
	mux.HandleFunc("/admin/orders/", m.wrapAuth(m.handleOrderDetail))
	mux.HandleFunc("/admin/orders/status", m.wrapAuth(m.handleUpdateOrderStatus))
	mux.HandleFunc("/admin/customers", m.wrapAuth(m.handleCustomers))
	mux.HandleFunc("/admin/media", m.wrapAuth(m.handleMedia))
	mux.HandleFunc("/admin/media/upload", m.wrapAuth(m.handleMediaUpload))
	mux.HandleFunc("/admin/media/import-url", m.wrapAuth(m.handleMediaImportURL))
	mux.HandleFunc("/admin/catalog/categories", m.wrapAuth(m.handleCatalogCategories))
	mux.HandleFunc("/admin/catalog/categories/", m.wrapAuth(m.handleCatalogCategoryDetail))
	mux.HandleFunc("/admin/catalog/products", m.wrapAuth(m.handleCatalogProducts))
	mux.HandleFunc("/admin/catalog/products/categories/bulk-assign", m.wrapAuth(m.handleCatalogProductsBulkAssignCategories))
	mux.HandleFunc("/admin/catalog/products/categories/bulk-remove", m.wrapAuth(m.handleCatalogProductsBulkRemoveCategories))
	mux.HandleFunc("/admin/catalog/products/discount/bulk", m.wrapAuth(m.handleCatalogProductsBulkDiscount))
	mux.HandleFunc("/admin/catalog/products/", m.wrapAuth(m.handleCatalogProductDetailActions))
	mux.HandleFunc("/admin/custom-options", m.wrapAuth(m.handleCustomOptions))
	mux.HandleFunc("/admin/custom-options/", m.wrapAuth(m.handleCustomOptionDetail))
	mux.HandleFunc("/admin/products/", m.wrapAuth(m.handleProductCustomOptionAssignments))
}

func (m *module) wrapAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m.user == "" || m.pass == "" {
			platformhttp.Error(w, http.StatusServiceUnavailable, "admin disabled")
			return
		}
		u, p, ok := r.BasicAuth()
		if !ok || u != m.user || p != m.pass {
			w.Header().Set("WWW-Authenticate", "Basic realm=admin")
			platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r)
	}
}

func (m *module) handleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if m.orders == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	metrics, err := m.orders.GetOrderMetrics(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "metrics error")
		return
	}

	recent, err := m.orders.ListOrders(r.Context(), 10, 0)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "recent orders error")
		return
	}

	recentOut := make([]map[string]any, 0, len(recent))
	for _, o := range recent {
		recentOut = append(recentOut, map[string]any{
			"id":          o.ID,
			"number":      o.Number,
			"status":      o.Status,
			"total_cents": o.TotalCents,
			"currency":    o.Currency,
			"created_at":  o.CreatedAt,
		})
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"metrics":       metrics,
		"recent_orders": recentOut,
	})
}

func (m *module) handleOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if r.URL.Path != "/admin/orders" {
		http.NotFound(w, r)
		return
	}
	if m.orders == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	qp := r.URL.Query()
	page := atoiDefault(qp.Get("page"), 1)
	limit := atoiDefault(qp.Get("limit"), 20)
	offset := (page - 1) * limit
	items, err := m.orders.ListOrders(r.Context(), limit, offset)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list error")
		return
	}
	outItems := make([]map[string]any, 0, len(items))
	for _, o := range items {
		outItems = append(outItems, map[string]any{
			"id":          o.ID,
			"number":      o.Number,
			"status":      o.Status,
			"currency":    o.Currency,
			"total_cents": o.TotalCents,
			"created_at":  o.CreatedAt,
		})
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"items": outItems,
		"page":  page,
		"limit": limit,
	})
}

func (m *module) handleOrderDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if !strings.HasPrefix(r.URL.Path, "/admin/orders/") {
		http.NotFound(w, r)
		return
	}
	id := r.URL.Path[len("/admin/orders/"):]
	if i := strings.IndexByte(id, '/'); i >= 0 {
		id = id[:i]
	}
	id = strings.TrimSpace(id)
	if id == "" {
		http.NotFound(w, r)
		return
	}
	if m.orders == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	o, err := m.orders.GetOrderByID(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			platformhttp.Error(w, http.StatusNotFound, "not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "get error")
		return
	}
	// Return the raw order struct; frontend admin can render fields and items
	_ = platformhttp.JSON(w, http.StatusOK, o)
}

type updateOrderStatusRequest struct {
	OrderID string `json:"order_id"`
	Status  string `json:"status"`
}

func (m *module) handleUpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	if m.orders == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	var req updateOrderStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	req.OrderID = strings.TrimSpace(req.OrderID)
	req.Status = strings.TrimSpace(req.Status)
	if req.OrderID == "" || req.Status == "" {
		platformhttp.Error(w, http.StatusBadRequest, "missing fields")
		return
	}

	// Validate status
	validStatuses := map[string]bool{
		"pending_payment": true,
		"paid":            true,
		"cancelled":       true,
	}
	if !validStatuses[req.Status] {
		platformhttp.Error(w, http.StatusBadRequest, "invalid status")
		return
	}

	if err := m.orders.UpdateOrderStatus(r.Context(), req.OrderID, req.Status); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "update error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (m *module) handleCustomers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if r.URL.Path != "/admin/customers" {
		http.NotFound(w, r)
		return
	}
	if m.customers == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	qp := r.URL.Query()
	page := atoiDefault(qp.Get("page"), 1)
	limit := atoiDefault(qp.Get("limit"), 20)
	offset := (page - 1) * limit
	items, err := m.customers.ListCustomers(r.Context(), limit, offset)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list error")
		return
	}
	outItems := make([]map[string]any, 0, len(items))
	for _, customer := range items {
		outItems = append(outItems, map[string]any{
			"id":         customer.ID,
			"email":      customer.Email,
			"created_at": customer.CreatedAt,
			"updated_at": customer.UpdatedAt,
		})
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"items": outItems,
		"page":  page,
		"limit": limit,
	})
}

func atoiDefault(s string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || n == 0 {
		return def
	}
	return n
}

type ordersStore interface {
	GetOrderMetrics(ctx context.Context) (stororders.OrderMetrics, error)
	ListOrders(ctx context.Context, limit, offset int) ([]stororders.Order, error)
	GetOrderByID(ctx context.Context, id string) (stororders.Order, error)
	UpdateOrderStatus(ctx context.Context, id string, status string) error
}

type customersStore interface {
	ListCustomers(ctx context.Context, limit, offset int) ([]storcustomers.AdminCustomer, error)
}

type catalogStore interface {
	CreateCategory(ctx context.Context, in storcat.CategoryUpsertInput) (storcat.Category, error)
	ListAdminCategories(ctx context.Context) ([]storcat.AdminCategory, error)
	UpdateCategory(ctx context.Context, id string, in storcat.CategoryUpsertInput) (storcat.Category, error)
	DeleteCategory(ctx context.Context, id string) (storcat.DeleteCategoryResult, error)
	CreateProduct(ctx context.Context, in storcat.ProductUpsertInput) (storcat.Product, error)
	CreateProductVariant(ctx context.Context, productID string, in storcat.ProductVariantCreateInput) (storcat.Variant, error)
	UpdateProduct(ctx context.Context, id string, in storcat.ProductUpsertInput) (storcat.Product, error)
	DeleteProduct(ctx context.Context, id string) error
	ReplaceProductCategories(ctx context.Context, productID string, categoryIDs []string) error
	BulkAssignProductCategories(ctx context.Context, productIDs []string, categoryIDs []string) (int64, error)
	BulkRemoveProductCategories(ctx context.Context, productIDs []string, categoryIDs []string) (int64, error)
	ApplyDiscountToProducts(ctx context.Context, productIDs []string, in storcat.ProductDiscountInput) (int64, error)
	ListCustomOptions(ctx context.Context, in storcat.ListCustomOptionsParams) ([]storcat.ProductCustomOption, error)
	CreateCustomOption(ctx context.Context, in storcat.CustomOptionUpsertInput) (storcat.ProductCustomOption, error)
	GetCustomOptionByID(ctx context.Context, id string) (storcat.ProductCustomOption, error)
	UpdateCustomOption(ctx context.Context, id string, in storcat.CustomOptionUpsertInput) (storcat.ProductCustomOption, error)
	DeleteCustomOption(ctx context.Context, id string) error
	ListProductCustomOptionAssignments(ctx context.Context, productID string) ([]storcat.ProductCustomOptionAssignment, error)
	AttachProductCustomOption(ctx context.Context, productID, optionID string, sortOrder *int) (storcat.ProductCustomOptionAssignment, error)
	DetachProductCustomOption(ctx context.Context, productID, optionID string) error
}

type mediaStore interface {
	CreateAsset(ctx context.Context, in stormedia.CreateAssetInput) (stormedia.Asset, error)
	ListAssets(ctx context.Context, in stormedia.ListAssetsParams) ([]stormedia.Asset, error)
}

type upsertCategoryRequest struct {
	Slug            string  `json:"slug"`
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	ParentID        *string `json:"parent_id"`
	DefaultImageURL *string `json:"default_image_url"`
	SEOTitle        *string `json:"seo_title"`
	SEODescription  *string `json:"seo_description"`
}

type upsertProductRequest struct {
	Slug           string   `json:"slug"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Status         *string  `json:"status"`
	Tags           []string `json:"tags"`
	SEOTitle       *string  `json:"seo_title"`
	SEODescription *string  `json:"seo_description"`
}

type createVariantRequest struct {
	SKU        string  `json:"sku"`
	PriceCents int     `json:"price_cents"`
	Currency   *string `json:"currency"`
	Stock      int     `json:"stock"`
}

type replaceProductCategoriesRequest struct {
	CategoryIDs []string `json:"category_ids"`
}

type bulkProductCategoriesRequest struct {
	ProductIDs  []string `json:"product_ids"`
	CategoryIDs []string `json:"category_ids"`
}

type discountRequest struct {
	Mode               string   `json:"mode"`
	DiscountPriceCents *int     `json:"discount_price_cents"`
	DiscountPercent    *float64 `json:"discount_percent"`
}

type bulkDiscountRequest struct {
	ProductIDs []string `json:"product_ids"`
	discountRequest
}

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func (m *module) handleCatalogCategories(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/admin/catalog/categories" {
		http.NotFound(w, r)
		return
	}
	if m.catalog == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	if r.Method == http.MethodGet {
		items, err := m.catalog.ListAdminCategories(r.Context())
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "list categories error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
			"items": items,
		})
		return
	}

	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	var req upsertCategoryRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	in, err := validateCategoryRequest(req)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	item, err := m.catalog.CreateCategory(r.Context(), in)
	if err != nil {
		writeCatalogStoreError(w, err, "create category error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusCreated, item)
}

func (m *module) handleCatalogCategoryDetail(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/admin/catalog/categories/") {
		http.NotFound(w, r)
		return
	}
	if m.catalog == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	id := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/admin/catalog/categories/"))
	if id == "" || strings.Contains(id, "/") {
		http.NotFound(w, r)
		return
	}

	if r.Method == http.MethodDelete {
		result, err := m.catalog.DeleteCategory(r.Context(), id)
		if err != nil {
			writeCatalogStoreError(w, err, "delete category error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, result)
		return
	}

	if r.Method != http.MethodPatch {
		http.NotFound(w, r)
		return
	}

	var req upsertCategoryRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	in, err := validateCategoryRequest(req)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	item, err := m.catalog.UpdateCategory(r.Context(), id, in)
	if err != nil {
		writeCatalogStoreError(w, err, "update category error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, item)
}

func (m *module) handleCatalogProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/admin/catalog/products" {
		http.NotFound(w, r)
		return
	}
	if m.catalog == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var req upsertProductRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	in, err := validateProductRequest(req)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	item, err := m.catalog.CreateProduct(r.Context(), in)
	if err != nil {
		writeCatalogStoreError(w, err, "create product error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusCreated, item)
}

func (m *module) handleCatalogProductsBulkAssignCategories(w http.ResponseWriter, r *http.Request) {
	m.handleCatalogProductsBulkCategories(w, r, true)
}

func (m *module) handleCatalogProductsBulkRemoveCategories(w http.ResponseWriter, r *http.Request) {
	m.handleCatalogProductsBulkCategories(w, r, false)
}

func (m *module) handleCatalogProductsBulkCategories(w http.ResponseWriter, r *http.Request, assign bool) {
	expectedPath := "/admin/catalog/products/categories/bulk-remove"
	if assign {
		expectedPath = "/admin/catalog/products/categories/bulk-assign"
	}
	if r.Method != http.MethodPost || r.URL.Path != expectedPath {
		http.NotFound(w, r)
		return
	}
	if m.catalog == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var req bulkProductCategoriesRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	req.ProductIDs = cleanNonEmptyStrings(req.ProductIDs)
	req.CategoryIDs = cleanNonEmptyStrings(req.CategoryIDs)
	if len(req.ProductIDs) == 0 || len(req.CategoryIDs) == 0 {
		platformhttp.Error(w, http.StatusBadRequest, "product_ids and category_ids are required")
		return
	}

	var (
		affected int64
		err      error
	)
	if assign {
		affected, err = m.catalog.BulkAssignProductCategories(r.Context(), req.ProductIDs, req.CategoryIDs)
	} else {
		affected, err = m.catalog.BulkRemoveProductCategories(r.Context(), req.ProductIDs, req.CategoryIDs)
	}
	if err != nil {
		writeCatalogStoreError(w, err, "bulk category update error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"affected": affected})
}

func (m *module) handleCatalogProductsBulkDiscount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/admin/catalog/products/discount/bulk" {
		http.NotFound(w, r)
		return
	}
	if m.catalog == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var req bulkDiscountRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	req.ProductIDs = cleanNonEmptyStrings(req.ProductIDs)
	if len(req.ProductIDs) == 0 {
		platformhttp.Error(w, http.StatusBadRequest, "product_ids are required")
		return
	}
	in, err := validateDiscountRequest(req.discountRequest)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	updated, err := m.catalog.ApplyDiscountToProducts(r.Context(), req.ProductIDs, in)
	if err != nil {
		writeCatalogStoreError(w, err, "bulk discount error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"updated_variants": updated})
}

func (m *module) handleCatalogProductDetailActions(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/admin/catalog/products/") {
		http.NotFound(w, r)
		return
	}
	if m.catalog == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	rest := strings.TrimPrefix(r.URL.Path, "/admin/catalog/products/")
	parts := strings.Split(rest, "/")
	if len(parts) == 0 || strings.TrimSpace(parts[0]) == "" {
		http.NotFound(w, r)
		return
	}
	id := strings.TrimSpace(parts[0])

	if len(parts) == 1 {
		if r.Method == http.MethodDelete {
			if err := m.catalog.DeleteProduct(r.Context(), id); err != nil {
				writeCatalogStoreError(w, err, "delete product error")
				return
			}
			_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"id": id})
			return
		}
		if r.Method == http.MethodPatch {
			var req upsertProductRequest
			if err := decodeRequest(r, &req); err != nil {
				platformhttp.Error(w, http.StatusBadRequest, err.Error())
				return
			}
			in, err := validateProductRequest(req)
			if err != nil {
				platformhttp.Error(w, http.StatusBadRequest, err.Error())
				return
			}
			item, err := m.catalog.UpdateProduct(r.Context(), id, in)
			if err != nil {
				writeCatalogStoreError(w, err, "update product error")
				return
			}
			_ = platformhttp.JSON(w, http.StatusOK, item)
			return
		}
		http.NotFound(w, r)
		return
	}

	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	switch parts[1] {
	case "categories":
		if r.Method != http.MethodPut {
			http.NotFound(w, r)
			return
		}
		var req replaceProductCategoriesRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		categoryIDs := cleanNonEmptyStrings(req.CategoryIDs)
		if err := m.catalog.ReplaceProductCategories(r.Context(), id, categoryIDs); err != nil {
			writeCatalogStoreError(w, err, "replace categories error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"product_id": id, "category_ids": categoryIDs})
	case "variants":
		if r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		var req createVariantRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		in, err := validateVariantCreateRequest(req)
		if err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := m.catalog.CreateProductVariant(r.Context(), id, in)
		if err != nil {
			writeCatalogStoreError(w, err, "create variant error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusCreated, item)
	case "discount":
		if r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		var req discountRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		in, err := validateDiscountRequest(req)
		if err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		updated, err := m.catalog.ApplyDiscountToProducts(r.Context(), []string{id}, in)
		if err != nil {
			writeCatalogStoreError(w, err, "discount error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"updated_variants": updated})
	default:
		http.NotFound(w, r)
	}
}

func decodeRequest(r *http.Request, dst any) error {
	defer r.Body.Close()
	const maxBodyBytes = 1 << 20
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		return errors.New("invalid json body")
	}
	if len(body) == 0 {
		return errors.New("request body is required")
	}
	if len(body) > maxBodyBytes {
		return errors.New("request body too large")
	}

	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("request body is required")
		}
		return errors.New("invalid json body")
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return errors.New("invalid json body")
	}
	return nil
}

func validateCategoryRequest(req upsertCategoryRequest) (storcat.CategoryUpsertInput, error) {
	slug := strings.TrimSpace(req.Slug)
	name := strings.TrimSpace(req.Name)
	if !isValidSlug(slug) {
		return storcat.CategoryUpsertInput{}, errors.New("invalid slug")
	}
	if name == "" {
		return storcat.CategoryUpsertInput{}, errors.New("name is required")
	}
	if !isValidOptionalURL(req.DefaultImageURL) {
		return storcat.CategoryUpsertInput{}, errors.New("default_image_url must be a valid http/https URL")
	}
	seoTitle, seoDescription, err := validateSEO(req.SEOTitle, req.SEODescription)
	if err != nil {
		return storcat.CategoryUpsertInput{}, err
	}
	parentID := normalizeOptionalString(req.ParentID)
	defaultImageURL := normalizeOptionalString(req.DefaultImageURL)
	return storcat.CategoryUpsertInput{
		Slug:            slug,
		Name:            name,
		Description:     strings.TrimSpace(req.Description),
		ParentID:        parentID,
		DefaultImageURL: defaultImageURL,
		SEOTitle:        seoTitle,
		SEODescription:  seoDescription,
	}, nil
}

func validateProductRequest(req upsertProductRequest) (storcat.ProductUpsertInput, error) {
	slug := strings.TrimSpace(req.Slug)
	title := strings.TrimSpace(req.Title)
	if !isValidSlug(slug) {
		return storcat.ProductUpsertInput{}, errors.New("invalid slug")
	}
	if title == "" {
		return storcat.ProductUpsertInput{}, errors.New("title is required")
	}
	status := "published"
	if req.Status != nil {
		status = strings.TrimSpace(strings.ToLower(*req.Status))
		if status == "" {
			status = "published"
		}
	}
	if status != "published" && status != "inactive" {
		return storcat.ProductUpsertInput{}, errors.New("status must be one of: published, inactive")
	}
	tags := cleanNonEmptyStrings(req.Tags)
	seoTitle, seoDescription, err := validateSEO(req.SEOTitle, req.SEODescription)
	if err != nil {
		return storcat.ProductUpsertInput{}, err
	}
	return storcat.ProductUpsertInput{
		Slug:           slug,
		Title:          title,
		Description:    strings.TrimSpace(req.Description),
		Status:         status,
		Tags:           tags,
		SEOTitle:       seoTitle,
		SEODescription: seoDescription,
	}, nil
}

func validateVariantCreateRequest(req createVariantRequest) (storcat.ProductVariantCreateInput, error) {
	sku := strings.TrimSpace(req.SKU)
	if sku == "" {
		return storcat.ProductVariantCreateInput{}, errors.New("sku is required")
	}
	if req.PriceCents < 0 {
		return storcat.ProductVariantCreateInput{}, errors.New("price_cents must be >= 0")
	}
	if req.Stock < 0 {
		return storcat.ProductVariantCreateInput{}, errors.New("stock must be >= 0")
	}
	currency := "USD"
	if req.Currency != nil {
		normalized := strings.TrimSpace(strings.ToUpper(*req.Currency))
		if normalized != "" {
			currency = normalized
		}
	}
	return storcat.ProductVariantCreateInput{
		SKU:        sku,
		PriceCents: req.PriceCents,
		Currency:   currency,
		Stock:      req.Stock,
	}, nil
}

func validateDiscountRequest(req discountRequest) (storcat.ProductDiscountInput, error) {
	mode := strings.TrimSpace(strings.ToLower(req.Mode))
	switch mode {
	case string(storcat.DiscountModePrice):
		if req.DiscountPriceCents == nil {
			return storcat.ProductDiscountInput{}, errors.New("discount_price_cents is required for mode=price")
		}
		if *req.DiscountPriceCents < 0 {
			return storcat.ProductDiscountInput{}, errors.New("discount_price_cents must be >= 0")
		}
		return storcat.ProductDiscountInput{
			Mode:               storcat.DiscountModePrice,
			DiscountPriceCents: req.DiscountPriceCents,
		}, nil
	case string(storcat.DiscountModePercent):
		if req.DiscountPercent == nil {
			return storcat.ProductDiscountInput{}, errors.New("discount_percent is required for mode=percent")
		}
		if *req.DiscountPercent <= 0 || *req.DiscountPercent >= 100 {
			return storcat.ProductDiscountInput{}, errors.New("discount_percent must be between 0 and 100")
		}
		return storcat.ProductDiscountInput{
			Mode:            storcat.DiscountModePercent,
			DiscountPercent: req.DiscountPercent,
		}, nil
	default:
		return storcat.ProductDiscountInput{}, errors.New("mode must be one of: price, percent")
	}
}

func validateSEO(title *string, description *string) (*string, *string, error) {
	normalizedTitle := normalizeOptionalString(title)
	if normalizedTitle != nil && len(*normalizedTitle) > 120 {
		return nil, nil, errors.New("seo_title must be <= 120 chars")
	}
	normalizedDescription := normalizeOptionalString(description)
	if normalizedDescription != nil && len(*normalizedDescription) > 320 {
		return nil, nil, errors.New("seo_description must be <= 320 chars")
	}
	return normalizedTitle, normalizedDescription, nil
}

func writeCatalogStoreError(w http.ResponseWriter, err error, fallbackMessage string) {
	switch {
	case errors.Is(err, storcat.ErrNotFound):
		platformhttp.Error(w, http.StatusNotFound, "not found")
	case errors.Is(err, storcat.ErrConflict):
		platformhttp.Error(w, http.StatusConflict, "conflict")
	default:
		platformhttp.Error(w, http.StatusInternalServerError, fallbackMessage)
	}
}

func normalizeOptionalString(v *string) *string {
	if v == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*v)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func isValidSlug(s string) bool {
	return slugPattern.MatchString(s)
}

func isValidOptionalURL(raw *string) bool {
	v := normalizeOptionalString(raw)
	if v == nil {
		return true
	}
	parsed, err := url.Parse(*v)
	if err != nil {
		return false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	return parsed.Host != ""
}

func cleanNonEmptyStrings(in []string) []string {
	if len(in) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, item := range in {
		id := strings.TrimSpace(item)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
