package admin

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"goecommerce/internal/app"
	platformhttp "goecommerce/internal/platform/http"
	platformshipping "goecommerce/internal/platform/shipping"
	platformversion "goecommerce/internal/platform/version"
	storcat "goecommerce/internal/storage/catalog"
	storcustomers "goecommerce/internal/storage/customers"
	stormedia "goecommerce/internal/storage/media"
	stororders "goecommerce/internal/storage/orders"
	storshipping "goecommerce/internal/storage/shipping"
)

type terminalStore interface {
	GetCachedTerminals(ctx context.Context, providerKey, country string) ([]byte, time.Time, error)
}

type module struct {
	orders              ordersStore
	customers           customersStore
	catalog             catalogStore
	media               mediaStore
	terminals           terminalStore
	validateImportHost  func(context.Context, string) error
	downloadImportImage func(context.Context, string) ([]byte, string, error)
	uploadsDir          string
	translationsDir     string
}

func NewModule(deps app.Deps) app.Module {
	var ost ordersStore
	if deps.DB != nil {
		if s, err := stororders.NewStore(context.Background(), deps.DB); err == nil {
			ost = s
		} else {
			slog.Error("module init: failed to create store", "module", "admin", "store", "orders", "error", err)
		}
	}
	var cust customersStore
	if deps.DB != nil {
		if s, err := storcustomers.NewStore(context.Background(), deps.DB); err == nil {
			cust = s
		} else {
			slog.Error("module init: failed to create store", "module", "admin", "store", "customers", "error", err)
		}
	}
	var cst catalogStore
	if deps.DB != nil {
		if s, err := storcat.NewStore(context.Background(), deps.DB); err == nil {
			cst = s
		} else {
			slog.Error("module init: failed to create store", "module", "admin", "store", "catalog", "error", err)
		}
	}
	var mst mediaStore
	if deps.DB != nil {
		if s, err := stormedia.NewStore(context.Background(), deps.DB); err == nil {
			mst = s
		} else {
			slog.Error("module init: failed to create store", "module", "admin", "store", "media", "error", err)
		}
	}
	var tst terminalStore
	if deps.DB != nil {
		if s, err := storshipping.NewStore(context.Background(), deps.DB); err == nil {
			tst = s
		} else {
			slog.Error("module init: failed to create store", "module", "admin", "store", "shipping", "error", err)
		}
	}
	uploadsDir := strings.TrimSpace(os.Getenv("UPLOADS_DIR"))
	if uploadsDir == "" {
		uploadsDir = "./tmp/uploads"
	}
	_ = os.MkdirAll(uploadsDir, 0o755)

	translationsDir := strings.TrimSpace(os.Getenv("TRANSLATIONS_DIR"))
	if translationsDir == "" {
		translationsDir = "./web/i18n/messages"
	}

	return &module{
		orders:          ost,
		customers:       cust,
		catalog:         cst,
		media:           mst,
		terminals:       tst,
		uploadsDir:      uploadsDir,
		translationsDir: translationsDir,
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
	mux.HandleFunc("/admin/dashboard", m.handleDashboard)
	mux.HandleFunc("/admin/orders", m.handleOrders)
	mux.HandleFunc("/admin/orders/", m.handleOrderDetail)
	mux.HandleFunc("/admin/orders/status", m.handleUpdateOrderStatus)
	mux.HandleFunc("/admin/customers", m.handleCustomers)
	mux.HandleFunc("/admin/customers/", m.handleCustomerDetailActions)
	mux.HandleFunc("/admin/customers/logs", m.handleCustomerActionLogs)
	mux.HandleFunc("/admin/customers/groups", m.handleCustomerGroups)
	mux.HandleFunc("/admin/customers/groups/", m.handleCustomerGroupDetail)
	mux.HandleFunc("/admin/security/blocked-ips", m.handleBlockedIPs)
	mux.HandleFunc("/admin/security/blocked-ips/", m.handleBlockedIPDetail)
	mux.HandleFunc("/admin/media", m.handleMedia)
	mux.HandleFunc("/admin/media/upload", m.handleMediaUpload)
	mux.HandleFunc("/admin/media/video/upload", m.handleMediaVideoUpload)
	mux.HandleFunc("/admin/media/import-url", m.handleMediaImportURL)
	mux.HandleFunc("/admin/media/", m.handleMediaDetail)
	mux.HandleFunc("/admin/catalog/categories", m.handleCatalogCategories)
	mux.HandleFunc("/admin/catalog/categories/", m.handleCatalogCategoryDetail)
	mux.HandleFunc("/admin/catalog/products", m.handleCatalogProducts)
	mux.HandleFunc("/admin/catalog/products/categories/bulk-assign", m.handleCatalogProductsBulkAssignCategories)
	mux.HandleFunc("/admin/catalog/products/categories/bulk-remove", m.handleCatalogProductsBulkRemoveCategories)
	mux.HandleFunc("/admin/catalog/products/discount/bulk", m.handleCatalogProductsBulkDiscount)
	mux.HandleFunc("/admin/catalog/products/", m.handleCatalogProductDetailActions)
	mux.HandleFunc("/admin/custom-options", m.handleCustomOptions)
	mux.HandleFunc("/admin/custom-options/", m.handleCustomOptionDetail)
	mux.HandleFunc("/admin/products/", m.handleProductCustomOptionAssignments)
	mux.HandleFunc("/admin/translations", m.handleTranslations)
	mux.HandleFunc("/admin/translations/", m.handleTranslationDetail)
	mux.HandleFunc("/admin/version-check", m.handleVersionCheck)
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

	trend, err := m.orders.GetWeeklyRevenueTrend(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "trend error")
		return
	}

	topProducts, err := m.orders.GetTopProducts(r.Context(), 5)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "top products error")
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
		"metrics":         metrics,
		"recent_orders":   recentOut,
		"revenue_trend":   trend,
		"top_products":    topProducts,
		"backend_version": platformversion.BackendVersion,
		"web_version":     platformversion.WebVersion,
	})
}

func (m *module) handleVersionCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	owner := strings.TrimSpace(os.Getenv("GITHUB_REPO_OWNER"))
	if owner == "" {
		owner = "bildukas2"
	}
	repo := strings.TrimSpace(os.Getenv("GITHUB_REPO_NAME"))
	if repo == "" {
		repo = "go-ecommerce"
	}

	channel := r.URL.Query().Get("channel")
	if channel != "dev" {
		channel = "prod"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	client := &http.Client{Timeout: 5 * time.Second}

	var latestVersion string

	if channel == "dev" {
		// Fetch version.json from the main branch raw content
		rawURL := "https://raw.githubusercontent.com/" + owner + "/" + repo + "/refs/heads/main/version.json"
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
		if err != nil {
			platformhttp.Error(w, http.StatusBadGateway, "failed to fetch latest version")
			return
		}
		if token := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := client.Do(req)
		if err != nil {
			slog.Warn("version check: raw github request failed", "error", err)
			platformhttp.Error(w, http.StatusBadGateway, "failed to fetch latest version")
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			slog.Warn("version check: raw github returned non-200", "status", resp.StatusCode)
			platformhttp.Error(w, http.StatusBadGateway, "failed to fetch latest version")
			return
		}
		var vj struct {
			Version string `json:"version"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&vj); err != nil || vj.Version == "" {
			platformhttp.Error(w, http.StatusBadGateway, "failed to fetch latest version")
			return
		}
		latestVersion = vj.Version
	} else {
		// Fetch latest GitHub Release tag
		apiURL := "https://api.github.com/repos/" + owner + "/" + repo + "/releases/latest"
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
		if err != nil {
			platformhttp.Error(w, http.StatusBadGateway, "failed to fetch latest version")
			return
		}
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
		if token := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := client.Do(req)
		if err != nil {
			slog.Warn("version check: github request failed", "error", err)
			platformhttp.Error(w, http.StatusBadGateway, "failed to fetch latest version")
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			slog.Warn("version check: github returned non-200", "status", resp.StatusCode)
			platformhttp.Error(w, http.StatusBadGateway, "failed to fetch latest version")
			return
		}
		var ghResp struct {
			TagName string `json:"tag_name"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&ghResp); err != nil {
			platformhttp.Error(w, http.StatusBadGateway, "failed to fetch latest version")
			return
		}
		latestVersion = strings.TrimPrefix(ghResp.TagName, "v")
	}

	current := platformversion.BackendVersion
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"current_version": current,
		"latest_version":  latestVersion,
		"up_to_date":      current == latestVersion,
		"channel":         channel,
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
			"id":            o.ID,
			"number":        o.Number,
			"status":        o.Status,
			"currency":      o.Currency,
			"total_cents":   o.TotalCents,
			"created_at":    o.CreatedAt,
			"customer_name": o.CustomerName,
			"customer_info": o.CustomerInfo,
			"shipment_type": o.ShipmentType,
			"payment_type":  o.PaymentType,
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
	items := make([]adminOrderDetailItemResponse, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, adminOrderDetailItemResponse{
			ID:                it.ID,
			OrderID:           it.OrderID,
			ProductVariantID:  it.ProductVariantID,
			UnitPriceCents:    it.UnitPriceCents,
			Currency:          it.Currency,
			Quantity:          it.Quantity,
			ProductTitle:      it.ProductTitle,
			VariantSKU:        it.VariantSKU,
			VariantAttributes: json.RawMessage(it.VariantAttrsJSON),
			CustomOptions:     json.RawMessage(it.CustomOptionsJSON),
			CreatedAt:         it.CreatedAt,
			UpdatedAt:         it.UpdatedAt,
		})
	}
	var terminalName, terminalAddress string
	if o.ShippingTerminalID != "" && o.ShippingProviderKey != "" && m.terminals != nil {
		country := o.ShippingCountry
		if country == "" {
			country = "EE"
		}
		if cached, _, err := m.terminals.GetCachedTerminals(r.Context(), o.ShippingProviderKey, country); err == nil && len(cached) > 0 {
			var terminals []platformshipping.Terminal
			if err := json.Unmarshal(cached, &terminals); err == nil {
				for _, t := range terminals {
					if t.ID == o.ShippingTerminalID {
						terminalName = t.Name
						parts := []string{}
						if t.Address != "" {
							parts = append(parts, t.Address)
						}
						if t.City != "" {
							parts = append(parts, t.City)
						}
						if t.Postcode != "" {
							parts = append(parts, t.Postcode)
						}
						if len(parts) > 0 {
							terminalAddress = strings.Join(parts, ", ")
						}
						break
					}
				}
			}
		}
	}
	resp := adminOrderDetailResponse{
		Order: adminOrderCoreResponse{
			ID:            o.ID,
			Number:        o.Number,
			Status:        o.Status,
			Currency:      o.Currency,
			SubtotalCents: o.SubtotalCents,
			ShippingCents: o.ShippingCents,
			TaxCents:      o.TaxCents,
			TotalCents:    o.TotalCents,
			CreatedAt:     o.CreatedAt,
			UpdatedAt:     o.UpdatedAt,
		},
		Customer: adminOrderCustomerResponse{
			ID:        o.CustomerID,
			Email:     o.CustomerEmail,
			Phone:     o.CustomerPhone,
			FirstName: o.CustomerFirstName,
			LastName:  o.CustomerLastName,
		},
		Shipping: adminOrderShippingResponse{
			MethodID:        o.ShippingMethodID,
			MethodTitle:     o.ShippingMethodTitle,
			ProviderKey:     o.ShippingProviderKey,
			ServiceCode:     o.ShippingServiceCode,
			TerminalID:      o.ShippingTerminalID,
			TerminalName:    terminalName,
			TerminalAddress: terminalAddress,
			PriceCents:      o.ShippingPriceCents,
			FullName:        o.ShippingFullName,
			Phone:           o.ShippingPhone,
			Address1:        o.ShippingAddress1,
			Address2:        o.ShippingAddress2,
			City:            o.ShippingCity,
			State:           o.ShippingState,
			Postcode:        o.ShippingPostcode,
			Country:         o.ShippingCountry,
		},
		Billing: adminOrderBillingResponse{
			FullName:     o.BillingFullName,
			Address1:     o.BillingAddress1,
			Address2:     o.BillingAddress2,
			City:         o.BillingCity,
			State:        o.BillingState,
			Postcode:     o.BillingPostcode,
			Country:      o.BillingCountry,
			CompanyName:  o.CompanyName,
			CompanyVAT:   o.CompanyVAT,
			InvoiceEmail: o.InvoiceEmail,
		},
		Payment: adminOrderPaymentResponse{
			Method:   o.PaymentMethod,
			Provider: o.PaymentProvider,
		},
		Items: items,
	}
	_ = platformhttp.JSON(w, http.StatusOK, resp)
}

type updateOrderStatusRequest struct {
	OrderID string `json:"order_id"`
	Status  string `json:"status"`
}

type adminOrderDetailResponse struct {
	Order    adminOrderCoreResponse         `json:"order"`
	Customer adminOrderCustomerResponse     `json:"customer"`
	Shipping adminOrderShippingResponse     `json:"shipping"`
	Billing  adminOrderBillingResponse      `json:"billing"`
	Payment  adminOrderPaymentResponse      `json:"payment"`
	Items    []adminOrderDetailItemResponse `json:"items"`
}

type adminOrderCoreResponse struct {
	ID            string    `json:"id"`
	Number        string    `json:"number"`
	Status        string    `json:"status"`
	Currency      string    `json:"currency"`
	SubtotalCents int       `json:"subtotal_cents"`
	ShippingCents int       `json:"shipping_cents"`
	TaxCents      int       `json:"tax_cents"`
	TotalCents    int       `json:"total_cents"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type adminOrderCustomerResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type adminOrderShippingResponse struct {
	MethodID        string `json:"method_id"`
	MethodTitle     string `json:"method_title"`
	ProviderKey     string `json:"provider_key"`
	ServiceCode     string `json:"service_code"`
	TerminalID      string `json:"terminal_id"`
	TerminalName    string `json:"terminal_name"`
	TerminalAddress string `json:"terminal_address"`
	PriceCents      int    `json:"price_cents"`
	FullName        string `json:"full_name"`
	Phone           string `json:"phone"`
	Address1        string `json:"address1"`
	Address2        string `json:"address2"`
	City            string `json:"city"`
	State           string `json:"state"`
	Postcode        string `json:"postcode"`
	Country         string `json:"country"`
}

type adminOrderBillingResponse struct {
	FullName     string `json:"full_name"`
	Address1     string `json:"address1"`
	Address2     string `json:"address2"`
	City         string `json:"city"`
	State        string `json:"state"`
	Postcode     string `json:"postcode"`
	Country      string `json:"country"`
	CompanyName  string `json:"company_name"`
	CompanyVAT   string `json:"company_vat"`
	InvoiceEmail string `json:"invoice_email"`
}

type adminOrderPaymentResponse struct {
	Method   string `json:"method"`
	Provider string `json:"provider"`
}

type adminOrderDetailItemResponse struct {
	ID                string          `json:"id"`
	OrderID           string          `json:"order_id"`
	ProductVariantID  string          `json:"product_variant_id"`
	UnitPriceCents    int             `json:"unit_price_cents"`
	Currency          string          `json:"currency"`
	Quantity          int             `json:"quantity"`
	ProductTitle      string          `json:"product_title"`
	VariantSKU        string          `json:"variant_sku"`
	VariantAttributes json.RawMessage `json:"variant_attributes_json"`
	CustomOptions     json.RawMessage `json:"custom_options_json"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
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
		"processing":      true,
		"completed":       true,
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
	GetWeeklyRevenueTrend(ctx context.Context) ([]stororders.DashboardTrendPoint, error)
	GetTopProducts(ctx context.Context, limit int) ([]stororders.DashboardTopProduct, error)
}

type customersStore interface {
	ListCustomers(ctx context.Context, in storcustomers.AdminCustomersListParams) (storcustomers.AdminCustomersPage, error)
	CreateAdminCustomer(ctx context.Context, in storcustomers.AdminCustomerUpsertInput) (storcustomers.AdminCustomer, error)
	UpdateAdminCustomer(ctx context.Context, id string, in storcustomers.AdminCustomerUpsertInput) (storcustomers.AdminCustomer, error)
	UpdateAdminCustomerStatus(ctx context.Context, id, status string) (storcustomers.AdminCustomer, error)
	ListCustomerActionLogs(ctx context.Context, in storcustomers.ListCustomerActionLogsParams) (storcustomers.CustomerActionLogsPage, error)
	InsertCustomerActionLog(ctx context.Context, in storcustomers.CreateCustomerActionLogInput) (storcustomers.CustomerActionLog, error)
	ListCustomerGroups(ctx context.Context) ([]storcustomers.CustomerGroup, error)
	CreateCustomerGroup(ctx context.Context, name, code string) (storcustomers.CustomerGroup, error)
	UpdateCustomerGroup(ctx context.Context, id, name, code string) (storcustomers.CustomerGroup, error)
	DeleteCustomerGroup(ctx context.Context, id string) error
	ListBlockedIPs(ctx context.Context) ([]storcustomers.BlockedIP, error)
	CreateBlockedIP(ctx context.Context, in storcustomers.CreateBlockedIPInput) (storcustomers.BlockedIP, error)
	DeleteBlockedIP(ctx context.Context, id string) (storcustomers.BlockedIP, error)
}

type catalogStore interface {
	CreateCategory(ctx context.Context, in storcat.CategoryUpsertInput) (storcat.Category, error)
	ListAdminCategories(ctx context.Context) ([]storcat.AdminCategory, error)
	UpdateCategory(ctx context.Context, id string, in storcat.CategoryUpsertInput) (storcat.Category, error)
	DeleteCategory(ctx context.Context, id string) (storcat.DeleteCategoryResult, error)
	CreateProduct(ctx context.Context, in storcat.ProductUpsertInput) (storcat.Product, error)
	CreateProductVariant(ctx context.Context, productID string, in storcat.ProductVariantCreateInput) (storcat.Variant, error)
	UpdateProductVariant(ctx context.Context, productID string, variantID string, in storcat.ProductVariantUpdateInput) (storcat.Variant, error)
	UpdateProduct(ctx context.Context, id string, in storcat.ProductUpsertInput) (storcat.Product, error)
	DeleteProduct(ctx context.Context, id string) error
	GetProductCategoryIDs(ctx context.Context, productID string) ([]string, error)
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
	AddProductImage(ctx context.Context, productID, url, alt string) (storcat.Image, error)
	RemoveProductImage(ctx context.Context, imageID, productID string) error
	SetDefaultProductImage(ctx context.Context, imageID, productID string) error
}

type mediaStore interface {
	CreateAsset(ctx context.Context, in stormedia.CreateAssetInput) (stormedia.Asset, error)
	ListAssets(ctx context.Context, in stormedia.ListAssetsParams) ([]stormedia.Asset, error)
	DeleteAsset(ctx context.Context, id string) (storagePath string, err error)
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

	// Handle 4-part paths: /admin/catalog/products/{id}/images/{imageID}/default
	if len(parts) == 4 && parts[1] == "images" && parts[3] == "default" {
		imageID := strings.TrimSpace(parts[2])
		if imageID == "" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPatch {
			platformhttp.Error(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		if err := m.catalog.SetDefaultProductImage(r.Context(), imageID, id); err != nil {
			if err.Error() == "image not found" {
				platformhttp.Error(w, http.StatusNotFound, "image not found")
			} else {
				platformhttp.Error(w, http.StatusInternalServerError, "set default image error")
			}
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"id": imageID})
		return
	}

	// Handle 3-part paths: /admin/catalog/products/{id}/variants/{variantID}
	if len(parts) == 3 && parts[1] == "variants" {
		variantID := strings.TrimSpace(parts[2])
		if variantID == "" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPatch {
			platformhttp.Error(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			SKU        string `json:"sku"`
			PriceCents int    `json:"price_cents"`
			Stock      int    `json:"stock"`
		}
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		if req.SKU == "" {
			platformhttp.Error(w, http.StatusBadRequest, "sku is required")
			return
		}
		if req.PriceCents < 0 {
			platformhttp.Error(w, http.StatusBadRequest, "price_cents must be >= 0")
			return
		}
		if req.Stock < 0 {
			platformhttp.Error(w, http.StatusBadRequest, "stock must be >= 0")
			return
		}
		updated, err := m.catalog.UpdateProductVariant(r.Context(), id, variantID, storcat.ProductVariantUpdateInput{
			SKU:        strings.TrimSpace(req.SKU),
			PriceCents: req.PriceCents,
			Stock:      req.Stock,
		})
		if err != nil {
			writeCatalogStoreError(w, err, "update variant error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, updated)
		return
	}

	// Handle 3-part paths: /admin/catalog/products/{id}/images/{imageID}
	if len(parts) == 3 && parts[1] == "images" {
		imageID := strings.TrimSpace(parts[2])
		if imageID == "" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodDelete {
			platformhttp.Error(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		if err := m.catalog.RemoveProductImage(r.Context(), imageID, id); err != nil {
			if err.Error() == "image not found" {
				platformhttp.Error(w, http.StatusNotFound, "image not found")
			} else {
				platformhttp.Error(w, http.StatusInternalServerError, "remove image error")
			}
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"id": imageID})
		return
	}

	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	switch parts[1] {
	case "categories":
		if r.Method == http.MethodGet {
			ids, err := m.catalog.GetProductCategoryIDs(r.Context(), id)
			if err != nil {
				writeCatalogStoreError(w, err, "get product categories error")
				return
			}
			if ids == nil {
				ids = []string{}
			}
			_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"category_ids": ids})
			return
		}
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
	case "images":
		if r.Method != http.MethodPost {
			platformhttp.Error(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req struct {
			URL string `json:"url"`
			Alt string `json:"alt"`
		}
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		req.URL = strings.TrimSpace(req.URL)
		req.Alt = strings.TrimSpace(req.Alt)
		if req.URL == "" || !isValidOptionalURL(&req.URL) {
			platformhttp.Error(w, http.StatusBadRequest, "url must be a valid http/https URL")
			return
		}
		img, err := m.catalog.AddProductImage(r.Context(), id, req.URL, req.Alt)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "add image error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusCreated, img)
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
