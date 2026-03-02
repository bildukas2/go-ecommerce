package cms

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storcms "goecommerce/internal/storage/cms"
)

func (m *module) handleAdminNavigationMenus(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		menus, err := m.store.ListNavigationMenus(r.Context())
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to list navigation menus")
			return
		}
		resp := make([]NavigationMenuResponse, 0, len(menus))
		for _, menu := range menus {
			resp = append(resp, toNavigationMenuResponse(menu))
		}
		_ = platformhttp.JSON(w, http.StatusOK, resp)
	case http.MethodPost:
		var req CreateNavigationMenuRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := validateNavigationMenuRequest(req.Code, req.Name); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		menu, err := m.store.CreateNavigationMenu(r.Context(), storcms.NavigationMenu{
			Code:        strings.TrimSpace(req.Code),
			Name:        strings.TrimSpace(req.Name),
			Description: req.Description,
		})
		if err != nil {
			if errors.Is(err, storcms.ErrConflict) {
				platformhttp.Error(w, http.StatusConflict, "navigation menu code already exists")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "failed to create navigation menu")
			return
		}
		_ = platformhttp.JSON(w, http.StatusCreated, toNavigationMenuResponse(menu))
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleAdminNavigationMenuDetail(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodPut:
		var req UpdateNavigationMenuRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := validateNavigationMenuRequest(req.Code, req.Name); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		menu, err := m.store.UpdateNavigationMenu(r.Context(), storcms.NavigationMenu{
			ID:          id,
			Code:        strings.TrimSpace(req.Code),
			Name:        strings.TrimSpace(req.Name),
			Description: req.Description,
		})
		if err != nil {
			if errors.Is(err, storcms.ErrNotFound) {
				platformhttp.Error(w, http.StatusNotFound, "navigation menu not found")
				return
			}
			if errors.Is(err, storcms.ErrConflict) {
				platformhttp.Error(w, http.StatusConflict, "navigation menu code already exists")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "failed to update navigation menu")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, toNavigationMenuResponse(menu))
	case http.MethodDelete:
		err := m.store.DeleteNavigationMenu(r.Context(), id)
		if err != nil {
			if errors.Is(err, storcms.ErrNotFound) {
				platformhttp.Error(w, http.StatusNotFound, "navigation menu not found")
				return
			}
			if errors.Is(err, storcms.ErrConflict) {
				platformhttp.Error(w, http.StatusConflict, "cannot delete menu: it is assigned to one or more locations")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "failed to delete navigation menu")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleAdminNavigationMenuItems(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	menuID := strings.TrimSpace(r.PathValue("id"))
	if menuID == "" {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		items, err := m.store.ListNavigationItemsByMenu(r.Context(), menuID)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to list navigation items")
			return
		}
		resp := make([]NavigationItemResponse, 0, len(items))
		for _, item := range items {
			resp = append(resp, toNavigationItemResponse(item))
		}
		_ = platformhttp.JSON(w, http.StatusOK, resp)
	case http.MethodPost:
		var req CreateNavigationItemRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := validateNavigationRequest(req.Label, req.Type, req.PageID, req.CategoryID, req.URL); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		labelI18n := req.LabelI18n
		if len(labelI18n) == 0 {
			labelI18n = []byte("{}")
		}
		item, err := m.store.CreateNavigationItem(r.Context(), storcms.NavigationItem{
			MenuID:       menuID,
			Label:        strings.TrimSpace(req.Label),
			LabelI18n:    labelI18n,
			Type:         req.Type,
			PageID:       req.PageID,
			CategoryID:   req.CategoryID,
			URL:          req.URL,
			OpenInNewTab: req.OpenInNewTab,
			SortOrder:    req.SortOrder,
			IsActive:     req.IsActive,
		})
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to create navigation item")
			return
		}
		_ = platformhttp.JSON(w, http.StatusCreated, toNavigationItemResponse(item))
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleAdminNavigationItemDetail(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodPut:
		var req UpdateNavigationItemRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := validateNavigationRequest(req.Label, req.Type, req.PageID, req.CategoryID, req.URL); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		menuID := ""
		if req.MenuID != nil {
			menuID = strings.TrimSpace(*req.MenuID)
		}
		updateLabelI18n := req.LabelI18n
		if len(updateLabelI18n) == 0 {
			updateLabelI18n = []byte("{}")
		}
		item, err := m.store.UpdateNavigationItem(r.Context(), storcms.NavigationItem{
			ID:           id,
			MenuID:       menuID,
			Label:        strings.TrimSpace(req.Label),
			LabelI18n:    updateLabelI18n,
			Type:         req.Type,
			PageID:       req.PageID,
			CategoryID:   req.CategoryID,
			URL:          req.URL,
			OpenInNewTab: req.OpenInNewTab,
			SortOrder:    req.SortOrder,
			IsActive:     req.IsActive,
		})
		if err != nil {
			if errors.Is(err, storcms.ErrNotFound) {
				platformhttp.Error(w, http.StatusNotFound, "navigation item not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "failed to update navigation item")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, toNavigationItemResponse(item))
	case http.MethodDelete:
		if err := m.store.DeleteNavigationItem(r.Context(), id); err != nil {
			if errors.Is(err, storcms.ErrNotFound) {
				platformhttp.Error(w, http.StatusNotFound, "navigation item not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "failed to delete navigation item")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleAdminNavigationMenuReorder(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	if r.Method != http.MethodPut {
		http.NotFound(w, r)
		return
	}

	menuID := strings.TrimSpace(r.PathValue("id"))
	if menuID == "" {
		http.NotFound(w, r)
		return
	}

	var req ReorderNavigationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.ItemIDs) == 0 {
		platformhttp.Error(w, http.StatusBadRequest, "item_ids is required")
		return
	}
	for _, id := range req.ItemIDs {
		if strings.TrimSpace(id) == "" {
			platformhttp.Error(w, http.StatusBadRequest, "item_ids cannot contain empty values")
			return
		}
	}

	if err := m.store.UpdateNavigationMenuOrder(r.Context(), menuID, req.ItemIDs); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to reorder navigation items")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validateNavigationMenuRequest(code, name string) error {
	if strings.TrimSpace(code) == "" {
		return errors.New("code is required")
	}
	if strings.TrimSpace(name) == "" {
		return errors.New("name is required")
	}
	return nil
}

func toNavigationMenuResponse(m storcms.NavigationMenu) NavigationMenuResponse {
	return NavigationMenuResponse{
		ID:          m.ID,
		Code:        m.Code,
		Name:        m.Name,
		Description: m.Description,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}
