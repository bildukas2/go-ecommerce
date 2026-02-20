package admin

import (
	"errors"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storcustomers "goecommerce/internal/storage/customers"
)

type adminCustomerUpsertRequest struct {
	Email            *string `json:"email"`
	Phone            *string `json:"phone"`
	FirstName        string  `json:"first_name"`
	LastName         string  `json:"last_name"`
	Status           string  `json:"status"`
	GroupID          *string `json:"group_id"`
	IsAnonymous      bool    `json:"is_anonymous"`
	ShippingFullName string  `json:"shipping_full_name"`
	ShippingPhone    string  `json:"shipping_phone"`
	ShippingAddress1 string  `json:"shipping_address1"`
	ShippingAddress2 string  `json:"shipping_address2"`
	ShippingCity     string  `json:"shipping_city"`
	ShippingState    string  `json:"shipping_state"`
	ShippingPostcode string  `json:"shipping_postcode"`
	ShippingCountry  string  `json:"shipping_country"`
	BillingFullName  string  `json:"billing_full_name"`
	BillingAddress1  string  `json:"billing_address1"`
	BillingAddress2  string  `json:"billing_address2"`
	BillingCity      string  `json:"billing_city"`
	BillingState     string  `json:"billing_state"`
	BillingPostcode  string  `json:"billing_postcode"`
	BillingCountry   string  `json:"billing_country"`
	CompanyName      string  `json:"company_name"`
	CompanyVAT       string  `json:"company_vat"`
	InvoiceEmail     *string `json:"invoice_email"`
	WantsInvoice     bool    `json:"wants_invoice"`
}

type adminCustomerStatusRequest struct {
	Status string `json:"status"`
}

func (m *module) handleCustomers(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/admin/customers" {
		http.NotFound(w, r)
		return
	}
	if m.customers == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		qp := r.URL.Query()
		page := atoiDefault(qp.Get("page"), 1)
		limit := atoiDefault(qp.Get("limit"), 20)
		result, err := m.customers.ListCustomers(r.Context(), storcustomers.AdminCustomersListParams{
			Page:      page,
			Limit:     limit,
			Query:     strings.TrimSpace(qp.Get("q")),
			GroupID:   strings.TrimSpace(qp.Get("group")),
			Status:    strings.TrimSpace(qp.Get("status")),
			Anonymous: strings.TrimSpace(qp.Get("anonymous")),
			Sort:      strings.TrimSpace(qp.Get("sort")),
		})
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "list error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, result)
		return
	case http.MethodPost:
		var req adminCustomerUpsertRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := m.customers.CreateAdminCustomer(r.Context(), adminCustomerUpsertInput(req))
		if err != nil {
			writeAdminCustomerStoreError(w, err, "create customer error")
			return
		}
		infoSeverity := "info"
		m.writeCustomerActionLog(r, customerActionCreated, &item.ID, &infoSeverity, map[string]any{
			"customer_id":    item.ID,
			"email":          item.Email,
			"status":         item.Status,
			"is_anonymous":   item.IsAnonymous,
			"assigned_group": item.GroupID,
		})
		if item.GroupID != nil {
			m.writeCustomerActionLog(r, customerActionGroupChanged, &item.ID, &infoSeverity, map[string]any{
				"operation": "group_assigned",
				"group_id":  *item.GroupID,
			})
		}
		_ = platformhttp.JSON(w, http.StatusCreated, item)
		return
	default:
		http.NotFound(w, r)
		return
	}
}

func (m *module) handleCustomerDetailActions(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/admin/customers/") {
		http.NotFound(w, r)
		return
	}
	if m.customers == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	rest := strings.TrimPrefix(r.URL.Path, "/admin/customers/")
	parts := strings.Split(rest, "/")
	if len(parts) == 0 || strings.TrimSpace(parts[0]) == "" {
		http.NotFound(w, r)
		return
	}
	id := strings.TrimSpace(parts[0])
	if len(parts) == 1 {
		if r.Method != http.MethodPatch {
			http.NotFound(w, r)
			return
		}
		var req adminCustomerUpsertRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := m.customers.UpdateAdminCustomer(r.Context(), id, adminCustomerUpsertInput(req))
		if err != nil {
			writeAdminCustomerStoreError(w, err, "update customer error")
			return
		}
		infoSeverity := "info"
		m.writeCustomerActionLog(r, customerActionUpdated, &item.ID, &infoSeverity, map[string]any{
			"customer_id":  item.ID,
			"status":       item.Status,
			"is_anonymous": item.IsAnonymous,
		})
		if req.GroupID != nil {
			m.writeCustomerActionLog(r, customerActionGroupChanged, &item.ID, &infoSeverity, map[string]any{
				"operation": "group_changed",
				"group_id":  item.GroupID,
			})
		}
		_ = platformhttp.JSON(w, http.StatusOK, item)
		return
	}

	if len(parts) == 2 && parts[1] == "status" {
		if r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		var req adminCustomerStatusRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := m.customers.UpdateAdminCustomerStatus(r.Context(), id, req.Status)
		if err != nil {
			writeAdminCustomerStoreError(w, err, "update customer status error")
			return
		}
		infoSeverity := "info"
		action := customerActionDisabled
		if strings.EqualFold(item.Status, "active") {
			action = customerActionEnabled
		}
		m.writeCustomerActionLog(r, action, &item.ID, &infoSeverity, map[string]any{
			"customer_id": item.ID,
			"status":      item.Status,
		})
		_ = platformhttp.JSON(w, http.StatusOK, item)
		return
	}

	http.NotFound(w, r)
}

func adminCustomerUpsertInput(req adminCustomerUpsertRequest) storcustomers.AdminCustomerUpsertInput {
	return storcustomers.AdminCustomerUpsertInput{
		Email:            req.Email,
		Phone:            req.Phone,
		FirstName:        req.FirstName,
		LastName:         req.LastName,
		Status:           req.Status,
		GroupID:          req.GroupID,
		IsAnonymous:      req.IsAnonymous,
		ShippingFullName: req.ShippingFullName,
		ShippingPhone:    req.ShippingPhone,
		ShippingAddress1: req.ShippingAddress1,
		ShippingAddress2: req.ShippingAddress2,
		ShippingCity:     req.ShippingCity,
		ShippingState:    req.ShippingState,
		ShippingPostcode: req.ShippingPostcode,
		ShippingCountry:  req.ShippingCountry,
		BillingFullName:  req.BillingFullName,
		BillingAddress1:  req.BillingAddress1,
		BillingAddress2:  req.BillingAddress2,
		BillingCity:      req.BillingCity,
		BillingState:     req.BillingState,
		BillingPostcode:  req.BillingPostcode,
		BillingCountry:   req.BillingCountry,
		CompanyName:      req.CompanyName,
		CompanyVAT:       req.CompanyVAT,
		InvoiceEmail:     req.InvoiceEmail,
		WantsInvoice:     req.WantsInvoice,
	}
}

func writeAdminCustomerStoreError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, storcustomers.ErrNotFound):
		platformhttp.Error(w, http.StatusNotFound, "not found")
	case errors.Is(err, storcustomers.ErrConflict):
		platformhttp.Error(w, http.StatusConflict, "conflict")
	case errors.Is(err, storcustomers.ErrInvalid):
		platformhttp.Error(w, http.StatusBadRequest, "invalid customer payload")
	default:
		platformhttp.Error(w, http.StatusInternalServerError, fallback)
	}
}
