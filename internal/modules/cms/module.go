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
	mux.HandleFunc("/api/admin/pages", m.handleAdminPages)
	mux.HandleFunc("/api/admin/pages/", m.handleAdminPageDetail)
	mux.HandleFunc("/api/admin/pages/check-slug", m.handleAdminCheckSlug)
	
	mux.HandleFunc("/api/admin/navigation", m.handleAdminNavigation)
	mux.HandleFunc("/api/admin/navigation/", m.handleAdminNavigationDetail)
	mux.HandleFunc("/api/admin/navigation/reorder", m.handleAdminNavigationReorder)
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
