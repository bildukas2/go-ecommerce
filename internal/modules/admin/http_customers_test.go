package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	storcustomers "goecommerce/internal/storage/customers"
)

type fakeCustomersStore struct {
	listCustomersFn      func(context.Context, storcustomers.AdminCustomersListParams) (storcustomers.AdminCustomersPage, error)
	createCustomerFn     func(context.Context, storcustomers.AdminCustomerUpsertInput) (storcustomers.AdminCustomer, error)
	updateCustomerFn     func(context.Context, string, storcustomers.AdminCustomerUpsertInput) (storcustomers.AdminCustomer, error)
	updateStatusFn       func(context.Context, string, string) (storcustomers.AdminCustomer, error)
	listCustomerLogsFn   func(context.Context, storcustomers.ListCustomerActionLogsParams) (storcustomers.CustomerActionLogsPage, error)
	insertCustomerLogFn  func(context.Context, storcustomers.CreateCustomerActionLogInput) (storcustomers.CustomerActionLog, error)
	listCustomerGroupsFn func(context.Context) ([]storcustomers.CustomerGroup, error)
	createGroupFn        func(context.Context, string, string) (storcustomers.CustomerGroup, error)
	updateGroupFn        func(context.Context, string, string, string) (storcustomers.CustomerGroup, error)
	deleteGroupFn        func(context.Context, string) error
	listBlockedIPsFn     func(context.Context) ([]storcustomers.BlockedIP, error)
	createBlockedIPFn    func(context.Context, storcustomers.CreateBlockedIPInput) (storcustomers.BlockedIP, error)
	deleteBlockedIPFn    func(context.Context, string) (storcustomers.BlockedIP, error)
}

func (f *fakeCustomersStore) ListCustomers(
	ctx context.Context,
	in storcustomers.AdminCustomersListParams,
) (storcustomers.AdminCustomersPage, error) {
	if f.listCustomersFn == nil {
		return storcustomers.AdminCustomersPage{
			Items: []storcustomers.AdminCustomer{},
			Page:  in.Page,
			Limit: in.Limit,
		}, nil
	}
	return f.listCustomersFn(ctx, in)
}

func (f *fakeCustomersStore) CreateAdminCustomer(
	ctx context.Context,
	in storcustomers.AdminCustomerUpsertInput,
) (storcustomers.AdminCustomer, error) {
	if f.createCustomerFn == nil {
		return storcustomers.AdminCustomer{}, nil
	}
	return f.createCustomerFn(ctx, in)
}

func (f *fakeCustomersStore) UpdateAdminCustomer(
	ctx context.Context,
	id string,
	in storcustomers.AdminCustomerUpsertInput,
) (storcustomers.AdminCustomer, error) {
	if f.updateCustomerFn == nil {
		return storcustomers.AdminCustomer{}, nil
	}
	return f.updateCustomerFn(ctx, id, in)
}

func (f *fakeCustomersStore) UpdateAdminCustomerStatus(
	ctx context.Context,
	id string,
	status string,
) (storcustomers.AdminCustomer, error) {
	if f.updateStatusFn == nil {
		return storcustomers.AdminCustomer{}, nil
	}
	return f.updateStatusFn(ctx, id, status)
}

func (f *fakeCustomersStore) ListCustomerGroups(ctx context.Context) ([]storcustomers.CustomerGroup, error) {
	if f.listCustomerGroupsFn == nil {
		return []storcustomers.CustomerGroup{}, nil
	}
	return f.listCustomerGroupsFn(ctx)
}

func (f *fakeCustomersStore) ListCustomerActionLogs(
	ctx context.Context,
	in storcustomers.ListCustomerActionLogsParams,
) (storcustomers.CustomerActionLogsPage, error) {
	if f.listCustomerLogsFn == nil {
		return storcustomers.CustomerActionLogsPage{
			Items: []storcustomers.CustomerActionLog{},
			Page:  in.Page,
			Limit: in.Limit,
		}, nil
	}
	return f.listCustomerLogsFn(ctx, in)
}

func (f *fakeCustomersStore) InsertCustomerActionLog(
	ctx context.Context,
	in storcustomers.CreateCustomerActionLogInput,
) (storcustomers.CustomerActionLog, error) {
	if f.insertCustomerLogFn == nil {
		return storcustomers.CustomerActionLog{}, nil
	}
	return f.insertCustomerLogFn(ctx, in)
}

func (f *fakeCustomersStore) CreateCustomerGroup(ctx context.Context, name, code string) (storcustomers.CustomerGroup, error) {
	if f.createGroupFn == nil {
		return storcustomers.CustomerGroup{}, nil
	}
	return f.createGroupFn(ctx, name, code)
}

func (f *fakeCustomersStore) UpdateCustomerGroup(ctx context.Context, id, name, code string) (storcustomers.CustomerGroup, error) {
	if f.updateGroupFn == nil {
		return storcustomers.CustomerGroup{}, nil
	}
	return f.updateGroupFn(ctx, id, name, code)
}

func (f *fakeCustomersStore) DeleteCustomerGroup(ctx context.Context, id string) error {
	if f.deleteGroupFn == nil {
		return nil
	}
	return f.deleteGroupFn(ctx, id)
}

func (f *fakeCustomersStore) ListBlockedIPs(ctx context.Context) ([]storcustomers.BlockedIP, error) {
	if f.listBlockedIPsFn == nil {
		return []storcustomers.BlockedIP{}, nil
	}
	return f.listBlockedIPsFn(ctx)
}

func (f *fakeCustomersStore) CreateBlockedIP(ctx context.Context, in storcustomers.CreateBlockedIPInput) (storcustomers.BlockedIP, error) {
	if f.createBlockedIPFn == nil {
		return storcustomers.BlockedIP{}, nil
	}
	return f.createBlockedIPFn(ctx, in)
}

func (f *fakeCustomersStore) DeleteBlockedIP(ctx context.Context, id string) (storcustomers.BlockedIP, error) {
	if f.deleteBlockedIPFn == nil {
		return storcustomers.BlockedIP{}, nil
	}
	return f.deleteBlockedIPFn(ctx, id)
}

func TestAdminCustomersListSuccess(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	email := "customer@example.com"
	latestIP := "198.51.100.10"
	store := &fakeCustomersStore{
		listCustomersFn: func(_ context.Context, in storcustomers.AdminCustomersListParams) (storcustomers.AdminCustomersPage, error) {
			if in.Page != 3 || in.Limit != 10 {
				t.Fatalf("unexpected pagination: %#v", in)
			}
			if in.Query != "customer" || in.GroupID != "grp-1" || in.Status != "active" || in.Anonymous != "registered" || in.Sort != "anonymous_desc" {
				t.Fatalf("unexpected filters/sort: %#v", in)
			}
			return storcustomers.AdminCustomersPage{
				Items: []storcustomers.AdminCustomer{
					{
						ID:          "cust-1",
						Email:       &email,
						Status:      "active",
						IsAnonymous: false,
						LatestIP:    &latestIP,
						CreatedAt:   now,
						UpdatedAt:   now,
					},
				},
				Total: 1,
				Page:  in.Page,
				Limit: in.Limit,
			}, nil
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(
		http.MethodGet,
		"/admin/customers?page=3&limit=10&q=customer&group=grp-1&status=active&anonymous=registered&sort=anonymous_desc",
		nil,
	)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload struct {
		Items []map[string]any `json:"items"`
		Page  int              `json:"page"`
		Limit int              `json:"limit"`
		Total int              `json:"total"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload.Page != 3 || payload.Limit != 10 || payload.Total != 1 {
		t.Fatalf("unexpected pagination response: %#v", payload)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one customer, got %d", len(payload.Items))
	}
	if payload.Items[0]["email"] != "customer@example.com" {
		t.Fatalf("unexpected customer payload: %#v", payload.Items[0])
	}
	if payload.Items[0]["latest_ip"] != latestIP {
		t.Fatalf("expected latest_ip in customer payload, got %#v", payload.Items[0]["latest_ip"])
	}
}

func TestAdminCustomersUnavailableWithoutStore(t *testing.T) {
	m := &module{user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/customers", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)

	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, res.Code)
	}
}

func TestAdminCustomersCreateSuccess(t *testing.T) {
	email := "new@example.com"
	store := &fakeCustomersStore{
		createCustomerFn: func(_ context.Context, in storcustomers.AdminCustomerUpsertInput) (storcustomers.AdminCustomer, error) {
			if in.Email == nil || *in.Email != email {
				t.Fatalf("unexpected create input email: %#v", in.Email)
			}
			if in.Status != "active" {
				t.Fatalf("unexpected create input status: %q", in.Status)
			}
			return storcustomers.AdminCustomer{
				ID:          "cust-new",
				Email:       &email,
				Status:      "active",
				IsAnonymous: false,
			}, nil
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/customers", map[string]any{
		"email":        email,
		"first_name":   "New",
		"last_name":    "Customer",
		"status":       "active",
		"is_anonymous": false,
	})
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, res.Code)
	}
}

func TestAdminCustomersUpdateConflict(t *testing.T) {
	store := &fakeCustomersStore{
		updateCustomerFn: func(_ context.Context, id string, _ storcustomers.AdminCustomerUpsertInput) (storcustomers.AdminCustomer, error) {
			if id != "cust-1" {
				t.Fatalf("unexpected id: %s", id)
			}
			return storcustomers.AdminCustomer{}, storcustomers.ErrConflict
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminJSONRequest(t, mux, http.MethodPatch, "/admin/customers/cust-1", map[string]any{
		"email":        "dup@example.com",
		"first_name":   "Dup",
		"last_name":    "Customer",
		"status":       "active",
		"is_anonymous": false,
	})
	if res.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d", http.StatusConflict, res.Code)
	}
}

func TestAdminCustomersStatusUpdateValidation(t *testing.T) {
	store := &fakeCustomersStore{
		updateStatusFn: func(_ context.Context, _ string, _ string) (storcustomers.AdminCustomer, error) {
			return storcustomers.AdminCustomer{}, storcustomers.ErrInvalid
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/customers/cust-1/status", map[string]any{
		"status": "paused",
	})
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func TestAdminCustomerGroupsListSuccess(t *testing.T) {
	store := &fakeCustomersStore{
		listCustomerGroupsFn: func(_ context.Context) ([]storcustomers.CustomerGroup, error) {
			return []storcustomers.CustomerGroup{
				{
					ID:            "grp-1",
					Name:          "General",
					Code:          "general",
					IsDefault:     true,
					CustomerCount: 2,
				},
			}, nil
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/customers/groups", nil)
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
		t.Fatalf("unmarshal response: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected 1 group, got %d", len(payload.Items))
	}
	if payload.Items[0]["code"] != "general" {
		t.Fatalf("unexpected payload: %#v", payload.Items[0])
	}
}

func TestAdminCustomerGroupsCreateConflict(t *testing.T) {
	store := &fakeCustomersStore{
		createGroupFn: func(_ context.Context, _, _ string) (storcustomers.CustomerGroup, error) {
			return storcustomers.CustomerGroup{}, storcustomers.ErrConflict
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/customers/groups", map[string]any{
		"name": "General",
		"code": "general",
	})
	if res.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d", http.StatusConflict, res.Code)
	}
}

func TestAdminCustomerGroupsUpdateProtected(t *testing.T) {
	store := &fakeCustomersStore{
		updateGroupFn: func(_ context.Context, _, _, _ string) (storcustomers.CustomerGroup, error) {
			return storcustomers.CustomerGroup{}, storcustomers.ErrProtected
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminJSONRequest(t, mux, http.MethodPatch, "/admin/customers/groups/grp-1", map[string]any{
		"name": "New Name",
		"code": "new-name",
	})
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, res.Code)
	}
}

func TestAdminCustomerGroupsDeleteAssignedConflict(t *testing.T) {
	store := &fakeCustomersStore{
		deleteGroupFn: func(_ context.Context, _ string) error {
			return storcustomers.ErrGroupAssigned
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodDelete, "/admin/customers/groups/grp-1", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d", http.StatusConflict, res.Code)
	}
}

func TestAdminCustomerActionLogsListFiltersAndPagination(t *testing.T) {
	now := time.Now().UTC()
	store := &fakeCustomersStore{
		listCustomerLogsFn: func(_ context.Context, in storcustomers.ListCustomerActionLogsParams) (storcustomers.CustomerActionLogsPage, error) {
			if in.Page != 2 || in.Limit != 15 {
				t.Fatalf("unexpected pagination: page=%d limit=%d", in.Page, in.Limit)
			}
			if in.Query != "10.1.1.1" || in.Action != "customer.created" {
				t.Fatalf("unexpected filters: %#v", in)
			}
			if in.From == nil || in.To == nil {
				t.Fatalf("expected from/to filters to be parsed")
			}
			return storcustomers.CustomerActionLogsPage{
				Items: []storcustomers.CustomerActionLog{
					{
						ID:        "log-1",
						IP:        "10.1.1.1",
						Action:    "customer.created",
						MetaJSON:  []byte(`{"source":"test"}`),
						CreatedAt: now,
					},
				},
				Total: 1,
				Page:  in.Page,
				Limit: in.Limit,
			}, nil
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(
		http.MethodGet,
		"/admin/customers/logs?page=2&limit=15&q=10.1.1.1&action=customer.created&from=2026-02-01&to=2026-02-19",
		nil,
	)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload struct {
		Items []map[string]any `json:"items"`
		Total float64          `json:"total"`
		Page  float64          `json:"page"`
		Limit float64          `json:"limit"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected 1 log row, got %d", len(payload.Items))
	}
	if payload.Items[0]["ip"] != "10.1.1.1" {
		t.Fatalf("expected IP in row payload, got %#v", payload.Items[0])
	}
}

func TestAdminCustomerGroupsCreateWritesActionLogWithIP(t *testing.T) {
	var captured *storcustomers.CreateCustomerActionLogInput
	store := &fakeCustomersStore{
		createGroupFn: func(_ context.Context, name, code string) (storcustomers.CustomerGroup, error) {
			return storcustomers.CustomerGroup{
				ID:   "grp-2",
				Name: name,
				Code: code,
			}, nil
		},
		insertCustomerLogFn: func(_ context.Context, in storcustomers.CreateCustomerActionLogInput) (storcustomers.CustomerActionLog, error) {
			copy := in
			captured = &copy
			return storcustomers.CustomerActionLog{}, nil
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body, err := json.Marshal(map[string]any{
		"name": "VIP",
		"code": "vip",
	})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/admin/customers/groups", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", "198.51.100.42")
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, res.Code)
	}
	if captured == nil {
		t.Fatalf("expected log insertion")
	}
	if captured.IP != "198.51.100.42" {
		t.Fatalf("expected captured log IP to match request IP, got %q", captured.IP)
	}
	if captured.Action != "customer.group_changed" {
		t.Fatalf("unexpected captured log action %q", captured.Action)
	}
}

func TestAdminBlockedIPsListSuccess(t *testing.T) {
	expiresAt := time.Now().UTC().Add(24 * time.Hour).Round(time.Second)
	store := &fakeCustomersStore{
		listBlockedIPsFn: func(_ context.Context) ([]storcustomers.BlockedIP, error) {
			return []storcustomers.BlockedIP{
				{
					ID:        "block-1",
					IP:        "203.0.113.5",
					ExpiresAt: &expiresAt,
				},
			}, nil
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/security/blocked-ips", nil)
	req.SetBasicAuth("admin", "pass")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
}

func TestAdminBlockedIPsCreateLogsSecurityAction(t *testing.T) {
	var (
		capturedInput *storcustomers.CreateBlockedIPInput
		capturedLog   *storcustomers.CreateCustomerActionLogInput
	)
	store := &fakeCustomersStore{
		createBlockedIPFn: func(_ context.Context, in storcustomers.CreateBlockedIPInput) (storcustomers.BlockedIP, error) {
			copy := in
			capturedInput = &copy
			return storcustomers.BlockedIP{
				ID: "block-2",
				IP: in.IP,
			}, nil
		},
		insertCustomerLogFn: func(_ context.Context, in storcustomers.CreateCustomerActionLogInput) (storcustomers.CustomerActionLog, error) {
			copy := in
			capturedLog = &copy
			return storcustomers.CustomerActionLog{}, nil
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body, err := json.Marshal(map[string]any{
		"ip":     "203.0.113.40",
		"reason": "abuse",
	})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/admin/security/blocked-ips", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth("admin", "pass")
	req.Header.Set("X-Forwarded-For", "198.51.100.1")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, res.Code)
	}
	if capturedInput == nil || capturedInput.IP != "203.0.113.40" {
		t.Fatalf("expected create blocked ip input capture, got %#v", capturedInput)
	}
	if capturedLog == nil {
		t.Fatalf("expected action log insertion")
	}
	if capturedLog.Action != "ip.blocked" {
		t.Fatalf("unexpected action %q", capturedLog.Action)
	}
}

func TestAdminBlockedIPsDeleteLogsSecurityAction(t *testing.T) {
	var capturedLog *storcustomers.CreateCustomerActionLogInput
	store := &fakeCustomersStore{
		deleteBlockedIPFn: func(_ context.Context, id string) (storcustomers.BlockedIP, error) {
			if id != "block-3" {
				t.Fatalf("unexpected delete id %q", id)
			}
			return storcustomers.BlockedIP{
				ID: "block-3",
				IP: "203.0.113.99",
			}, nil
		},
		insertCustomerLogFn: func(_ context.Context, in storcustomers.CreateCustomerActionLogInput) (storcustomers.CustomerActionLog, error) {
			copy := in
			capturedLog = &copy
			return storcustomers.CustomerActionLog{}, nil
		},
	}
	m := &module{customers: store, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodDelete, "/admin/security/blocked-ips/block-3", nil)
	req.SetBasicAuth("admin", "pass")
	req.Header.Set("X-Forwarded-For", "198.51.100.2")
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
	if capturedLog == nil {
		t.Fatalf("expected action log insertion")
	}
	if capturedLog.Action != "ip.unblocked" {
		t.Fatalf("unexpected action %q", capturedLog.Action)
	}
}

func TestAdminBlockedIPsCreateValidation(t *testing.T) {
	m := &module{customers: &fakeCustomersStore{}, user: "admin", pass: "pass"}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/security/blocked-ips", map[string]any{
		"ip": "not-an-ip",
	})
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}
