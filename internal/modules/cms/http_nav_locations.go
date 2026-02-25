package cms

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storcms "goecommerce/internal/storage/cms"
)

func (m *module) handleAdminNavigationLocations(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	locations, err := m.store.ListNavigationLocations(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to list navigation locations")
		return
	}

	resp := make([]NavigationLocationResponse, 0, len(locations))
	for _, loc := range locations {
		resp = append(resp, toNavigationLocationResponse(loc))
	}
	_ = platformhttp.JSON(w, http.StatusOK, resp)
}

func (m *module) handleAdminNavigationLocationDetail(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	if r.Method != http.MethodPut {
		http.NotFound(w, r)
		return
	}

	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		http.NotFound(w, r)
		return
	}

	var req AssignNavigationLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	menuID := ""
	if req.MenuID != nil {
		menuID = strings.TrimSpace(*req.MenuID)
	} else if req.MenuIDCamel != nil {
		menuID = strings.TrimSpace(*req.MenuIDCamel)
	}

	if err := m.store.AssignNavigationLocation(r.Context(), code, menuID); err != nil {
		if errors.Is(err, storcms.ErrNotFound) {
			platformhttp.Error(w, http.StatusNotFound, "navigation location or menu not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to assign navigation location")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func toNavigationLocationResponse(loc storcms.NavigationLocation) NavigationLocationResponse {
	return NavigationLocationResponse{
		ID:                  loc.ID,
		Code:                loc.Code,
		Name:                loc.Name,
		Description:         loc.Description,
		MenuID:              loc.MenuID,
		MenuCode:            loc.MenuCode,
		MenuName:            loc.MenuName,
		AssignmentUpdatedAt: loc.AssignmentAt,
	}
}
