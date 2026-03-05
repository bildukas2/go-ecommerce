package settings

import (
	"context"
	"log/slog"
	"net/http"

	"goecommerce/internal/app"
	storeshop "goecommerce/internal/storage/shop"
)

type store interface {
	GetSettings(ctx context.Context) (storeshop.Settings, error)
	UpdateSettings(ctx context.Context, in storeshop.UpdateSettingsInput) (storeshop.Settings, error)
}

type module struct {
	store store
}

func NewModule(deps app.Deps) app.Module {
	var st store
	if deps.DB != nil {
		if s, err := storeshop.NewStore(context.Background(), deps.DB); err == nil {
			st = s
		} else {
			slog.Error("module init: failed to create store", "module", "settings", "store", "shop", "error", err)
		}
	}

	return &module{store: st}
}

func (m *module) Name() string {
	return "settings"
}

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/admin/settings/shop", m.handleAdminShopSettings)
	mux.HandleFunc("/settings/shop", m.handleStorefrontShopSettings)
}

func (m *module) Close() error {
	if m.store != nil {
		if closer, ok := m.store.(interface{ Close() error }); ok {
			return closer.Close()
		}
	}
	return nil
}
