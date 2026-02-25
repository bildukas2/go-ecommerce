package cms

import (
	"context"
	"log/slog"
	"net/http"
	"regexp"

	"goecommerce/internal/app"
	storcms "goecommerce/internal/storage/cms"
)

type module struct {
	store *storcms.Store
}

func NewModule(deps app.Deps) app.Module {
	var s *storcms.Store
	if deps.DB != nil {
		if st, err := storcms.NewStore(context.Background(), deps.DB); err == nil {
			s = st
		} else {
			slog.Error("module init: failed to create store", "module", "cms", "store", "cms", "error", err)
		}
	}
	return &module{store: s}
}

func (m *module) Close() error {
	if m.store != nil {
		return m.store.Close()
	}
	return nil
}

func (m *module) Name() string { return "cms" }

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	// Admin API
	mux.HandleFunc("GET /admin/pages", m.handleAdminPages)
	mux.HandleFunc("POST /admin/pages", m.handleAdminPages)
	mux.HandleFunc("GET /admin/pages/{id}", m.handleAdminPageDetail)
	mux.HandleFunc("PUT /admin/pages/{id}", m.handleAdminPageDetail)
	mux.HandleFunc("DELETE /admin/pages/{id}", m.handleAdminPageDetail)
	mux.HandleFunc("GET /admin/pages/check-slug", m.handleAdminCheckSlug)

	// Public API
	mux.HandleFunc("GET /pages/{slug}", m.handleGetPageBySlug)

	mux.HandleFunc("GET /admin/navigation/menus", m.handleAdminNavigationMenus)
	mux.HandleFunc("POST /admin/navigation/menus", m.handleAdminNavigationMenus)
	mux.HandleFunc("PUT /admin/navigation/menus/{id}", m.handleAdminNavigationMenuDetail)
	mux.HandleFunc("DELETE /admin/navigation/menus/{id}", m.handleAdminNavigationMenuDetail)
	mux.HandleFunc("GET /admin/navigation/menus/{id}/items", m.handleAdminNavigationMenuItems)
	mux.HandleFunc("POST /admin/navigation/menus/{id}/items", m.handleAdminNavigationMenuItems)
	mux.HandleFunc("PUT /admin/navigation/menus/{id}/reorder", m.handleAdminNavigationMenuReorder)
	mux.HandleFunc("PUT /admin/navigation/items/{id}", m.handleAdminNavigationItemDetail)
	mux.HandleFunc("DELETE /admin/navigation/items/{id}", m.handleAdminNavigationItemDetail)
	mux.HandleFunc("GET /admin/navigation/locations", m.handleAdminNavigationLocations)
	mux.HandleFunc("PUT /admin/navigation/locations/{code}", m.handleAdminNavigationLocationDetail)

	// Legacy endpoint kept until admin UI migration completes.
	mux.HandleFunc("GET /admin/navigation", m.handleAdminNavigation)
	mux.HandleFunc("POST /admin/navigation", m.handleAdminNavigation)
	mux.HandleFunc("GET /admin/navigation/{id}", m.handleAdminNavigationDetail)
	mux.HandleFunc("PUT /admin/navigation/{id}", m.handleAdminNavigationDetail)
	mux.HandleFunc("DELETE /admin/navigation/{id}", m.handleAdminNavigationDetail)
	mux.HandleFunc("PUT /admin/navigation/reorder", m.handleAdminNavigationReorder)

	mux.HandleFunc("GET /navigation/locations", m.handleNavigationLocations)
	mux.HandleFunc("GET /navigation/location/{code}", m.handleNavigationLocationByCode)
}

var (
	scriptTagPattern    = regexp.MustCompile(`(?i)<script\b[^>]*>([\s\S]*?)<\/script>`)
	eventHandlerPattern = regexp.MustCompile(`(?i)\bon[a-z]+\s*=\s*"[^"]*"|\bon[a-z]+\s*=\s*'[^']*'|\bon[a-z]+\s*=\s*[^\s>]+`)
)

func sanitizeHTML(html string) string {
	// Simple script tag removal
	s := scriptTagPattern.ReplaceAllString(html, "")
	// Simple event handler removal (onmouseover, onclick, etc.)
	s = eventHandlerPattern.ReplaceAllString(s, "")
	return s
}
