package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	storcat "goecommerce/internal/storage/catalog"
)

func TestAdminListCustomOptionsSuccess(t *testing.T) {
	store := &fakeCatalogStore{
		listCustomOptionsFn: func(_ context.Context, in storcat.ListCustomOptionsParams) ([]storcat.ProductCustomOption, error) {
			if in.Query != "gift" {
				t.Fatalf("unexpected query: %q", in.Query)
			}
			if in.TypeGroup != "select" {
				t.Fatalf("unexpected type_group: %q", in.TypeGroup)
			}
			return []storcat.ProductCustomOption{{ID: "opt-1", Title: "Gift Wrap", TypeGroup: "select", Type: "dropdown"}}, nil
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/custom-options?q=gift&type_group=select", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
}

func TestAdminCreateCustomOptionValidationError(t *testing.T) {
	m := &module{catalog: &fakeCatalogStore{}, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"code":        "gift-message",
		"title":       "x",
		"type_group":  "text",
		"type":        "field",
		"price_type":  "fixed",
		"price_value": 0,
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/custom-options", body)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func TestAdminCreateCustomOptionSuccess(t *testing.T) {
	store := &fakeCatalogStore{
		createCustomOptionFn: func(_ context.Context, in storcat.CustomOptionUpsertInput) (storcat.ProductCustomOption, error) {
			if in.TypeGroup != storcat.CustomOptionTypeGroupSelect || len(in.Values) != 1 {
				t.Fatalf("unexpected input: %#v", in)
			}
			return storcat.ProductCustomOption{ID: "opt-1", Code: in.Code, Title: in.Title, TypeGroup: in.TypeGroup, Type: in.Type, Values: []storcat.ProductCustomOptionValue{{ID: "val-1", Title: "Red"}}}, nil
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"code":       "shirt-color",
		"title":      "Shirt Color",
		"type_group": "select",
		"type":       "dropdown",
		"required":   true,
		"is_active":  true,
		"values": []map[string]any{
			{"title": "Red", "price_type": "fixed", "price_value": 0},
		},
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/custom-options", body)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, res.Code)
	}
}

func TestAdminDeleteCustomOptionAssignedConflict(t *testing.T) {
	store := &fakeCatalogStore{
		deleteCustomOptionFn: func(_ context.Context, _ string) error {
			return storcat.ErrConflict
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodDelete, "/admin/custom-options/opt-1", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d", http.StatusConflict, res.Code)
	}
	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["error"] != "option is assigned to products" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestAdminProductCustomOptionAssignmentsListSuccess(t *testing.T) {
	store := &fakeCatalogStore{
		listAssignmentsFn: func(_ context.Context, productID string) ([]storcat.ProductCustomOptionAssignment, error) {
			if productID != "prod-1" {
				t.Fatalf("unexpected product id: %s", productID)
			}
			return []storcat.ProductCustomOptionAssignment{
				{ProductID: productID, OptionID: "opt-1", SortOrder: 3},
			}, nil
		},
		getCustomOptionByIDFn: func(_ context.Context, id string) (storcat.ProductCustomOption, error) {
			return storcat.ProductCustomOption{ID: id, Title: "Gift Message", TypeGroup: "text", Type: "field"}, nil
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/products/prod-1/custom-options", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
}

func TestAdminProductCustomOptionAssignmentsListSkipOrphaned(t *testing.T) {
	store := &fakeCatalogStore{
		listAssignmentsFn: func(_ context.Context, productID string) ([]storcat.ProductCustomOptionAssignment, error) {
			return []storcat.ProductCustomOptionAssignment{
				{ProductID: productID, OptionID: "opt-exists", SortOrder: 1},
				{ProductID: productID, OptionID: "opt-orphaned", SortOrder: 2},
			}, nil
		},
		getCustomOptionByIDFn: func(_ context.Context, id string) (storcat.ProductCustomOption, error) {
			if id == "opt-exists" {
				return storcat.ProductCustomOption{ID: id, Title: "Existing"}, nil
			}
			return storcat.ProductCustomOption{}, storcat.ErrNotFound
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/products/prod-1/custom-options", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(payload.Items) != 1 {
		t.Fatalf("expected 1 item (orphaned skipped), got %d", len(payload.Items))
	}
	if payload.Items[0]["option_id"] != "opt-exists" {
		t.Fatalf("expected opt-exists, got %v", payload.Items[0]["option_id"])
	}
}

func TestAdminProductCustomOptionAttachValidationError(t *testing.T) {
	m := &module{catalog: &fakeCatalogStore{}, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{"sort_order": 2}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/products/prod-1/custom-options", body)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func TestAdminProductCustomOptionAttachSuccess(t *testing.T) {
	store := &fakeCatalogStore{
		attachAssignmentFn: func(_ context.Context, productID, optionID string, sortOrder *int) (storcat.ProductCustomOptionAssignment, error) {
			if productID != "prod-1" || optionID != "opt-2" {
				t.Fatalf("unexpected payload")
			}
			if sortOrder == nil || *sortOrder != 7 {
				t.Fatalf("unexpected sort order: %#v", sortOrder)
			}
			return storcat.ProductCustomOptionAssignment{ProductID: productID, OptionID: optionID, SortOrder: *sortOrder}, nil
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{"option_id": "opt-2", "sort_order": 7}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/products/prod-1/custom-options", body)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, res.Code)
	}
}

func TestAdminProductCustomOptionDetachNotFound(t *testing.T) {
	store := &fakeCatalogStore{
		detachAssignmentFn: func(_ context.Context, _, _ string) error {
			return storcat.ErrNotFound
		},
	}
	m := &module{catalog: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodDelete, "/admin/products/prod-1/custom-options/opt-1", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, res.Code)
	}
}
