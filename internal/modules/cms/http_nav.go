package cms

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storcms "goecommerce/internal/storage/cms"
)

func (m *module) handleAdminNavigation(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		m.handleAdminListNavigation(w, r)
	case http.MethodPost:
		m.handleAdminCreateNavigation(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleAdminNavigationDetail(w http.ResponseWriter, r *http.Request) {
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
		m.handleAdminGetNavigation(w, r, id)
	case http.MethodPut:
		m.handleAdminUpdateNavigation(w, r, id)
	case http.MethodDelete:
		m.handleAdminDeleteNavigation(w, r, id)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleAdminListNavigation(w http.ResponseWriter, r *http.Request) {
	items, err := m.store.ListNavigationItems(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to list navigation items")
		return
	}

	resp := make([]NavigationItemResponse, 0, len(items))
	for _, item := range items {
		resp = append(resp, toNavigationItemResponse(item))
	}

	_ = platformhttp.JSON(w, http.StatusOK, resp)
}

func (m *module) handleAdminCreateNavigation(w http.ResponseWriter, r *http.Request) {
	var req CreateNavigationItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := validateNavigationRequest(req.Label, req.Type, req.PageID, req.CategoryID, req.URL); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	item, err := m.store.CreateNavigationItem(r.Context(), storcms.NavigationItem{
		MenuID:       "",
		Label:        req.Label,
		LabelI18n:    req.LabelI18n,
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
}

func (m *module) handleAdminGetNavigation(w http.ResponseWriter, r *http.Request, id string) {
	item, err := m.store.GetNavigationItem(r.Context(), id)
	if err != nil {
		if errors.Is(err, storcms.ErrNotFound) {
			platformhttp.Error(w, http.StatusNotFound, "navigation item not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to get navigation item")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, toNavigationItemResponse(item))
}

func (m *module) handleAdminUpdateNavigation(w http.ResponseWriter, r *http.Request, id string) {
	var req UpdateNavigationItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := validateNavigationRequest(req.Label, req.Type, req.PageID, req.CategoryID, req.URL); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	item, err := m.store.UpdateNavigationItem(r.Context(), storcms.NavigationItem{
		ID:           id,
		MenuID:       "",
		Label:        req.Label,
		LabelI18n:    req.LabelI18n,
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
}

func (m *module) handleAdminDeleteNavigation(w http.ResponseWriter, r *http.Request, id string) {
	err := m.store.DeleteNavigationItem(r.Context(), id)
	if err != nil {
		if errors.Is(err, storcms.ErrNotFound) {
			platformhttp.Error(w, http.StatusNotFound, "navigation item not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to delete navigation item")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (m *module) handleAdminNavigationReorder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.NotFound(w, r)
		return
	}

	var req ReorderNavigationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var updates []storcms.NavOrderUpdate
	for idx, itemID := range req.ItemIDs {
		updates = append(updates, storcms.NavOrderUpdate{
			ID:        itemID,
			SortOrder: idx,
		})
	}

	if err := m.store.UpdateNavigationOrder(r.Context(), updates); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to update navigation order")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func validateNavigationRequest(label, navType string, pageID, categoryID, url *string) error {
	if strings.TrimSpace(label) == "" {
		return errors.New("label is required")
	}

	if navType != storcms.NavItemTypePage && navType != storcms.NavItemTypeURL && navType != storcms.NavItemTypeCategory {
		return errors.New("invalid navigation type")
	}

	if navType == storcms.NavItemTypePage && (pageID == nil || strings.TrimSpace(*pageID) == "") {
		return errors.New("page_id is required for type page")
	}

	if navType == storcms.NavItemTypeCategory && (categoryID == nil || strings.TrimSpace(*categoryID) == "") {
		return errors.New("category_id is required for type category")
	}

	if navType == storcms.NavItemTypeURL && (url == nil || strings.TrimSpace(*url) == "") {
		return errors.New("url is required for type url")
	}

	return nil
}

func toNavigationItemResponse(n storcms.NavigationItem) NavigationItemResponse {
	return NavigationItemResponse{
		ID:           n.ID,
		MenuID:       n.MenuID,
		Label:        n.Label,
		LabelI18n:    n.LabelI18n,
		Type:         n.Type,
		PageID:       n.PageID,
		CategoryID:   n.CategoryID,
		URL:          n.URL,
		OpenInNewTab: n.OpenInNewTab,
		SortOrder:    n.SortOrder,
		IsActive:     n.IsActive,
		CreatedAt:    n.CreatedAt,
		UpdatedAt:    n.UpdatedAt,
	}
}
