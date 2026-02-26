package cms

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	platformhttp "goecommerce/internal/platform/http"
	storcms "goecommerce/internal/storage/cms"
)

var (
	reservedSlugs = []string{"/", "/admin", "/api", "/checkout", "/cart", "/account", "/auth", "/shipping", "/orders"}
	slugRegex     = regexp.MustCompile(`^/[a-z0-9]+(?:-[a-z0-9]+)*$`)
)

func (m *module) handleAdminPages(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		m.handleAdminListPages(w, r)
	case http.MethodPost:
		m.handleAdminCreatePage(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleAdminPageDetail(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		m.handleAdminGetPage(w, r, id)
	case http.MethodPut:
		m.handleAdminUpdatePage(w, r, id)
	case http.MethodDelete:
		m.handleAdminDeletePage(w, r, id)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleAdminListPages(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	qp := r.URL.Query()

	limit, _ := strconv.Atoi(qp.Get("limit"))
	offset, _ := strconv.Atoi(qp.Get("offset"))

	pages, total, err := m.store.ListPages(ctx, storcms.ListPagesParams{
		Query:  qp.Get("query"),
		Status: qp.Get("status"),
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to list pages")
		return
	}

	resp := ListPagesResponse{
		Pages: make([]PageResponse, 0, len(pages)),
		Total: total,
	}

	for _, p := range pages {
		resp.Pages = append(resp.Pages, toPageResponse(p))
	}

	_ = platformhttp.JSON(w, http.StatusOK, resp)
}

func (m *module) handleAdminCreatePage(w http.ResponseWriter, r *http.Request) {
	var req CreatePageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := validatePageRequest(req.Title, req.Slug, req.Status); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	contentHTML := sanitizeHTML(req.ContentHTML)

	var publishedAt sql.NullTime
	if req.Status == storcms.PageStatusPublished {
		publishedAt = sql.NullTime{Time: time.Now(), Valid: true}
	}

	page, err := m.store.CreatePage(r.Context(), storcms.Page{
		Title:           req.Title,
		TitleI18n:       req.TitleI18n,
		Slug:            req.Slug,
		Status:          req.Status,
		ContentHTML:     contentHTML,
		ContentHTMLI18n: req.ContentHTMLI18n,
		ContentJSON:     req.ContentJSON,
		EditorMode:      req.EditorMode,
		MetaTitle:       req.MetaTitle,
		MetaDescription: req.MetaDescription,
		PublishedAt:     publishedAt,
	})
	if err != nil {
		if errors.Is(err, storcms.ErrConflict) {
			platformhttp.Error(w, http.StatusConflict, "slug already exists")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to create page")
		return
	}

	_ = platformhttp.JSON(w, http.StatusCreated, toPageResponse(page))
}

func (m *module) handleAdminGetPage(w http.ResponseWriter, r *http.Request, id string) {
	page, err := m.store.GetPageByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, storcms.ErrNotFound) {
			platformhttp.Error(w, http.StatusNotFound, "page not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to get page")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, toPageResponse(page))
}

func (m *module) handleAdminUpdatePage(w http.ResponseWriter, r *http.Request, id string) {
	var req UpdatePageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := validatePageRequest(req.Title, req.Slug, req.Status); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx := r.Context()
	oldPage, err := m.store.GetPageByID(ctx, id)
	if err != nil {
		if errors.Is(err, storcms.ErrNotFound) {
			platformhttp.Error(w, http.StatusNotFound, "page not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to get page")
		return
	}

	contentHTML := sanitizeHTML(req.ContentHTML)

	publishedAt := oldPage.PublishedAt
	if req.Status == storcms.PageStatusPublished && !publishedAt.Valid {
		publishedAt = sql.NullTime{Time: time.Now(), Valid: true}
	} else if req.Status == storcms.PageStatusDraft {
		publishedAt = sql.NullTime{Valid: false}
	}

	page, err := m.store.UpdatePage(ctx, storcms.Page{
		ID:              id,
		Title:           req.Title,
		TitleI18n:       req.TitleI18n,
		Slug:            req.Slug,
		Status:          req.Status,
		ContentHTML:     contentHTML,
		ContentHTMLI18n: req.ContentHTMLI18n,
		ContentJSON:     req.ContentJSON,
		EditorMode:      req.EditorMode,
		MetaTitle:       req.MetaTitle,
		MetaDescription: req.MetaDescription,
		PublishedAt:     publishedAt,
	})
	if err != nil {
		if errors.Is(err, storcms.ErrNotFound) {
			platformhttp.Error(w, http.StatusNotFound, "page not found")
			return
		}
		if errors.Is(err, storcms.ErrConflict) {
			platformhttp.Error(w, http.StatusConflict, "slug already exists")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to update page")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, toPageResponse(page))
}

func (m *module) handleAdminDeletePage(w http.ResponseWriter, r *http.Request, id string) {
	ctx := r.Context()

	// Check if page is used in navigation
	used, err := m.store.IsPageUsedInNavigation(ctx, id)
	if err == nil && used {
		platformhttp.Error(w, http.StatusConflict, "cannot delete page: it is used in navigation")
		return
	}

	err = m.store.DeletePage(ctx, id)
	if err != nil {
		if errors.Is(err, storcms.ErrNotFound) {
			platformhttp.Error(w, http.StatusNotFound, "page not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to delete page")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (m *module) handleAdminCheckSlug(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	slug := r.URL.Query().Get("slug")
	excludeID := r.URL.Query().Get("excludeId")

	if slug == "" {
		platformhttp.Error(w, http.StatusBadRequest, "slug is required")
		return
	}

	ctx := r.Context()
	page, err := m.store.GetPageBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, storcms.ErrNotFound) {
			_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"available": true})
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to check slug")
		return
	}

	available := excludeID != "" && page.ID == excludeID
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"available": available})
}

func (m *module) handleGetPageBySlug(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	// Ensure slug starts with /
	if !strings.HasPrefix(slug, "/") {
		slug = "/" + slug
	}

	page, err := m.store.GetPageBySlug(r.Context(), slug)
	if err != nil {
		if errors.Is(err, storcms.ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to get page")
		return
	}

	if page.Status != storcms.PageStatusPublished {
		http.NotFound(w, r)
		return
	}

	lang := r.URL.Query().Get("lang")
	page.Title = ResolveI18n(page.TitleI18n, lang, page.Title)
	page.ContentHTML = ResolveI18n(page.ContentHTMLI18n, lang, page.ContentHTML)

	_ = platformhttp.JSON(w, http.StatusOK, toPageResponse(page))
}

func validatePageRequest(title, slug, status string) error {
	if strings.TrimSpace(title) == "" {
		return errors.New("title is required")
	}

	if !slugRegex.MatchString(slug) {
		return errors.New("invalid slug format: must start with / and contain only lowercase letters, numbers, and hyphens")
	}

	for _, reserved := range reservedSlugs {
		if slug == reserved {
			return errors.New("slug is reserved")
		}
	}

	if status != storcms.PageStatusDraft && status != storcms.PageStatusPublished {
		return errors.New("invalid status")
	}

	return nil
}

func toPageResponse(p storcms.Page) PageResponse {
	var publishedAt *time.Time
	if p.PublishedAt.Valid {
		publishedAt = &p.PublishedAt.Time
	}

	return PageResponse{
		ID:              p.ID,
		Title:           p.Title,
		TitleI18n:       p.TitleI18n,
		Slug:            p.Slug,
		Status:          p.Status,
		ContentHTML:     p.ContentHTML,
		ContentHTMLI18n: p.ContentHTMLI18n,
		ContentJSON:     p.ContentJSON,
		EditorMode:      p.EditorMode,
		MetaTitle:       p.MetaTitle,
		MetaDescription: p.MetaDescription,
		CreatedAt:       p.CreatedAt,
		UpdatedAt:       p.UpdatedAt,
		PublishedAt:     publishedAt,
	}
}
