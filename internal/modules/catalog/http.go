package catalog

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"goecommerce/internal/app"
	platformhttp "goecommerce/internal/platform/http"
	storcat "goecommerce/internal/storage/catalog"
)

type module struct{}

func (m *module) Name() string { return "catalog" }

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/products", m.handleProductsList)
	mux.HandleFunc("/products/", m.handleProductDetail)
	mux.HandleFunc("/categories", m.handleCategories)
}

func init() {
	app.RegisterModule(&module{})
}

func getDB() *sql.DB {
	return app.CurrentDeps().DB
}

func (m *module) handleProductsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if r.URL.Path != "/products" {
		http.NotFound(w, r)
		return
	}
	db := getDB()
	if db == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	ctx := r.Context()
	store, err := storcat.NewStore(ctx, db)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "store init error")
		return
	}
	defer store.Close()
	qp := r.URL.Query()
	page := atoiDefault(qp.Get("page"), 1)
	limit := atoiDefault(qp.Get("limit"), 20)
	cat := strings.TrimSpace(qp.Get("category"))
	res, err := store.ListProducts(ctx, storcat.ListProductsParams{
		Pagination:  storcat.Pagination{Page: page, Limit: limit},
		CategorySlug: cat,
	})
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list error")
		return
	}
	out := map[string]any{
		"items": res.Items,
		"total": res.Total,
		"page":  res.Page,
		"limit": res.Limit,
	}
	_ = platformhttp.JSON(w, http.StatusOK, out)
}

func (m *module) handleProductDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if !strings.HasPrefix(r.URL.Path, "/products/") {
		http.NotFound(w, r)
		return
	}
	slug := r.URL.Path[len("/products/"):]
	if i := strings.IndexByte(slug, '/'); i >= 0 {
		slug = slug[:i]
	}
	slug = strings.TrimSpace(slug)
	if slug == "" {
		http.NotFound(w, r)
		return
	}
	db := getDB()
	if db == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	ctx := r.Context()
	store, err := storcat.NewStore(ctx, db)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "store init error")
		return
	}
	defer store.Close()
	p, err := store.GetProductBySlug(ctx, slug)
	if err != nil {
		if err == sql.ErrNoRows {
			platformhttp.Error(w, http.StatusNotFound, "not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "get error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, p)
}

func (m *module) handleCategories(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if r.URL.Path != "/categories" {
		http.NotFound(w, r)
		return
	}
	db := getDB()
	if db == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	ctx := r.Context()
	store, err := storcat.NewStore(ctx, db)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "store init error")
		return
	}
	defer store.Close()
	items, err := store.ListCategories(ctx)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list error")
		return
	}
	out := map[string]any{"items": items}
	_ = platformhttp.JSON(w, http.StatusOK, out)
}

func atoiDefault(s string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || n == 0 {
		return def
	}
	return n
}
