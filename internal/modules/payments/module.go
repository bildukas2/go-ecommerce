package payments

import (
	"net/http"
	"os"
	"strings"

	"goecommerce/internal/app"
	storpayments "goecommerce/internal/storage/payments"
)

type module struct {
	store paymentsStore
	user  string
	pass  string
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
		user:  strings.TrimSpace(os.Getenv("ADMIN_USER")),
		pass:  strings.TrimSpace(os.Getenv("ADMIN_PASS")),
	}
}

func (m *module) Name() string {
	return "payments"
}

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/payments/methods", m.handlePublicMethods)
	mux.HandleFunc("/admin/payments/methods", m.wrapAuth(m.handleAdminMethods))
	mux.HandleFunc("/admin/payments/methods/", m.wrapAuth(m.handleAdminMethods))
}

func (m *module) wrapAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m.user == "" || m.pass == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"error":"admin disabled"}`))
			return
		}

		u, p, ok := r.BasicAuth()
		if !ok || u != m.user || p != m.pass {
			w.Header().Set("WWW-Authenticate", "Basic realm=admin")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}

		next(w, r)
	}
}
