package payments

import (
	"net/http"

	"goecommerce/internal/app"
	storpayments "goecommerce/internal/storage/payments"
)

type module struct {
	store paymentsStore
}

type paymentsStore interface {
	storpayments.MethodsStore
}

func NewModule(deps app.Deps) app.Module {
	var store paymentsStore
	if deps.DB != nil {
		store = storpayments.New(deps.DB)
	}

	return &module{
		store: store,
	}
}

func (m *module) Name() string {
	return "payments"
}

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/payments/methods", m.handlePublicMethods)
	mux.HandleFunc("/admin/payments/methods", m.handleAdminMethods)
	mux.HandleFunc("/admin/payments/methods/", m.handleAdminMethods)
}
