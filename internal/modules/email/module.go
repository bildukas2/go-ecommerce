package email

import (
	"context"
	"log/slog"
	"net/http"

	"goecommerce/internal/app"
	storemail "goecommerce/internal/storage/email"
)

type store interface {
	GetSettings(ctx context.Context) (storemail.Settings, error)
	UpdateSettings(ctx context.Context, in storemail.UpdateSettingsInput) (storemail.Settings, error)
	ListTemplates(ctx context.Context) ([]storemail.Template, error)
	GetTemplateByCode(ctx context.Context, code string) (storemail.Template, error)
	UpdateTemplateByCode(ctx context.Context, code string, in storemail.UpdateTemplateInput) (storemail.Template, error)
}

type service interface {
	SendTest(ctx context.Context, to, lang string) error
}

type module struct {
	store   store
	service service
}

func NewModule(deps app.Deps) app.Module {
	var st store
	if deps.DB != nil {
		if s, err := storemail.NewStore(context.Background(), deps.DB); err == nil {
			st = s
		} else {
			slog.Error("module init: failed to create store", "module", "email", "store", "email", "error", err)
		}
	}

	var svc service
	if st != nil {
		svc = NewService(st)
	}

	return &module{
		store:   st,
		service: svc,
	}
}

func (m *module) Name() string {
	return "email"
}

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/admin/email/settings", m.handleAdminSettings)
	mux.HandleFunc("/admin/email/settings/test", m.handleAdminSettingsTest)
	mux.HandleFunc("/admin/email/templates", m.handleAdminTemplates)
	mux.HandleFunc("/admin/email/templates/", m.handleAdminTemplateByCode)
}

func (m *module) Close() error {
	if m.store != nil {
		if closer, ok := m.store.(interface{ Close() error }); ok {
			return closer.Close()
		}
	}
	return nil
}
