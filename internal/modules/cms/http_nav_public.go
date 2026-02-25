package cms

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storcms "goecommerce/internal/storage/cms"
)

func (m *module) handleNavigationLocations(w http.ResponseWriter, r *http.Request) {
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

	resp := make([]NavigationResolvedLocationResponse, 0, len(locations))
	for _, loc := range locations {
		resolved, err := m.resolveNavigationLocation(r.Context(), loc)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to resolve navigation locations")
			return
		}
		resp = append(resp, resolved)
	}

	_ = platformhttp.JSON(w, http.StatusOK, resp)
}

func (m *module) handleNavigationLocationByCode(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		http.NotFound(w, r)
		return
	}

	locations, err := m.store.ListNavigationLocations(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to list navigation locations")
		return
	}

	for _, loc := range locations {
		if loc.Code != code {
			continue
		}
		resolved, err := m.resolveNavigationLocation(r.Context(), loc)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to resolve navigation location")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, resolved)
		return
	}

	http.NotFound(w, r)
}

func (m *module) resolveNavigationLocation(ctx context.Context, loc storcms.NavigationLocation) (NavigationResolvedLocationResponse, error) {
	resp := NavigationResolvedLocationResponse{
		Code: loc.Code,
		Name: loc.Name,
	}
	if loc.MenuID == nil || loc.MenuCode == nil || loc.MenuName == nil {
		return resp, nil
	}

	items, err := m.store.ListNavigationItemsByMenu(ctx, *loc.MenuID)
	if err != nil {
		return NavigationResolvedLocationResponse{}, err
	}

	resolvedItems := make([]NavigationResolvedItemResponse, 0, len(items))
	for _, item := range items {
		if !item.IsActive {
			continue
		}
		href, ok, err := m.resolveNavigationItemHref(ctx, item)
		if err != nil {
			return NavigationResolvedLocationResponse{}, err
		}
		if !ok {
			continue
		}
		resolvedItems = append(resolvedItems, NavigationResolvedItemResponse{
			Label:        item.Label,
			Href:         href,
			Type:         item.Type,
			OpenInNewTab: item.OpenInNewTab,
		})
	}

	resp.Menu = &NavigationResolvedMenuResponse{
		ID:    *loc.MenuID,
		Code:  *loc.MenuCode,
		Name:  *loc.MenuName,
		Items: resolvedItems,
	}
	return resp, nil
}

func (m *module) resolveNavigationItemHref(ctx context.Context, item storcms.NavigationItem) (href string, ok bool, err error) {
	switch item.Type {
	case storcms.NavItemTypeURL:
		if item.URL == nil || strings.TrimSpace(*item.URL) == "" {
			return "", false, nil
		}
		return strings.TrimSpace(*item.URL), true, nil
	case storcms.NavItemTypePage:
		if item.PageID == nil || strings.TrimSpace(*item.PageID) == "" {
			return "", false, nil
		}
		slug, err := m.store.GetPublishedPageSlugByID(ctx, *item.PageID)
		if err != nil {
			if errors.Is(err, storcms.ErrNotFound) {
				return "", false, nil
			}
			return "", false, err
		}
		return resolvePageHref(slug), true, nil
	case storcms.NavItemTypeCategory:
		if item.CategoryID == nil || strings.TrimSpace(*item.CategoryID) == "" {
			return "", false, nil
		}
		slug, err := m.store.GetCategorySlugByID(ctx, *item.CategoryID)
		if err != nil {
			if errors.Is(err, storcms.ErrNotFound) {
				return "", false, nil
			}
			return "", false, err
		}
		return "/products?category=" + url.QueryEscape(slug), true, nil
	default:
		return "", false, nil
	}
}

func resolvePageHref(slug string) string {
	normalized := strings.TrimSpace(slug)
	if normalized == "" {
		return "/"
	}
	normalized = strings.TrimPrefix(normalized, "/")
	return "/page/" + normalized
}
