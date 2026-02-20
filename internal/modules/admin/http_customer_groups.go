package admin

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storcustomers "goecommerce/internal/storage/customers"
)

type upsertCustomerGroupRequest struct {
	Name string `json:"name"`
	Code string `json:"code"`
}

var multiDashPattern = regexp.MustCompile(`-+`)

func (m *module) handleCustomerGroups(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/admin/customers/groups" {
		http.NotFound(w, r)
		return
	}
	if m.customers == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		items, err := m.customers.ListCustomerGroups(r.Context())
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "list groups error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
		return
	case http.MethodPost:
		var req upsertCustomerGroupRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		name := strings.TrimSpace(req.Name)
		if name == "" {
			platformhttp.Error(w, http.StatusBadRequest, "name is required")
			return
		}
		code := normalizeGroupCode(name, req.Code)
		if !isValidSlug(code) {
			platformhttp.Error(w, http.StatusBadRequest, "invalid code")
			return
		}
		item, err := m.customers.CreateCustomerGroup(r.Context(), name, code)
		if err != nil {
			writeCustomerGroupStoreError(w, err, "create customer group error")
			return
		}
		infoSeverity := "info"
		m.writeCustomerActionLog(r, customerActionGroupChanged, nil, &infoSeverity, map[string]any{
			"operation":  "group_created",
			"group_id":   item.ID,
			"group_name": item.Name,
			"group_code": item.Code,
		})
		_ = platformhttp.JSON(w, http.StatusCreated, item)
		return
	default:
		http.NotFound(w, r)
		return
	}
}

func (m *module) handleCustomerGroupDetail(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/admin/customers/groups/") {
		http.NotFound(w, r)
		return
	}
	if m.customers == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	id := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/admin/customers/groups/"))
	if id == "" || strings.Contains(id, "/") {
		http.NotFound(w, r)
		return
	}

	if r.Method == http.MethodDelete {
		if err := m.customers.DeleteCustomerGroup(r.Context(), id); err != nil {
			writeCustomerGroupStoreError(w, err, "delete customer group error")
			return
		}
		infoSeverity := "info"
		m.writeCustomerActionLog(r, customerActionGroupChanged, nil, &infoSeverity, map[string]any{
			"operation": "group_deleted",
			"group_id":  id,
		})
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"id": id})
		return
	}
	if r.Method != http.MethodPatch {
		http.NotFound(w, r)
		return
	}

	var req upsertCustomerGroupRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		platformhttp.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	code := normalizeGroupCode(name, req.Code)
	if !isValidSlug(code) {
		platformhttp.Error(w, http.StatusBadRequest, "invalid code")
		return
	}

	item, err := m.customers.UpdateCustomerGroup(r.Context(), id, name, code)
	if err != nil {
		writeCustomerGroupStoreError(w, err, "update customer group error")
		return
	}
	infoSeverity := "info"
	m.writeCustomerActionLog(r, customerActionGroupChanged, nil, &infoSeverity, map[string]any{
		"operation":  "group_updated",
		"group_id":   item.ID,
		"group_name": item.Name,
		"group_code": item.Code,
	})
	_ = platformhttp.JSON(w, http.StatusOK, item)
}

func writeCustomerGroupStoreError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, storcustomers.ErrNotFound):
		platformhttp.Error(w, http.StatusNotFound, "not found")
	case errors.Is(err, storcustomers.ErrProtected):
		platformhttp.Error(w, http.StatusForbidden, "NOT LOGGED IN group is protected")
	case errors.Is(err, storcustomers.ErrGroupAssigned):
		platformhttp.Error(w, http.StatusConflict, "group is assigned to customers; reassign first")
	case errors.Is(err, storcustomers.ErrConflict):
		platformhttp.Error(w, http.StatusConflict, "conflict")
	default:
		platformhttp.Error(w, http.StatusInternalServerError, fallback)
	}
}

func normalizeGroupCode(name, code string) string {
	normalized := strings.ToLower(strings.TrimSpace(code))
	if normalized == "" {
		normalized = strings.ToLower(strings.TrimSpace(name))
	}
	normalized = strings.ReplaceAll(normalized, "_", "-")
	normalized = strings.ReplaceAll(normalized, " ", "-")
	normalized = multiDashPattern.ReplaceAllString(normalized, "-")
	return strings.Trim(normalized, "-")
}
