package payments

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storpayments "goecommerce/internal/storage/payments"
)

type methodRequest struct {
	Key          string          `json:"key"`
	Title        string          `json:"title"`
	Description  string          `json:"description"`
	Instructions string          `json:"instructions"`
	Enabled      bool            `json:"enabled"`
	PaymentType  string          `json:"payment_type"`
	ConfigJSON   json.RawMessage `json:"config_json"`
	SortOrder    int             `json:"sort_order"`
}

type methodResponse struct {
	ID           string          `json:"id"`
	Key          string          `json:"key"`
	Title        string          `json:"title"`
	Description  string          `json:"description"`
	Instructions string          `json:"instructions"`
	Enabled      bool            `json:"enabled"`
	PaymentType  string          `json:"payment_type"`
	ConfigJSON   json.RawMessage `json:"config_json"`
	SortOrder    int             `json:"sort_order"`
	CreatedAt    string          `json:"created_at"`
	UpdatedAt    string          `json:"updated_at"`
}

func decodeRequest(r *http.Request, dst any) error {
	defer r.Body.Close()
	const maxBodyBytes = 1 << 20
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		return errors.New("invalid json body")
	}
	if len(body) == 0 {
		return errors.New("request body is required")
	}
	if len(body) > maxBodyBytes {
		return errors.New("request body too large")
	}

	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("request body is required")
		}
		return errors.New("invalid json body")
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return errors.New("invalid json body")
	}
	return nil
}

func toMethodResponse(method storpayments.PaymentMethod) methodResponse {
	config := method.ConfigJSON
	if config == nil {
		config = []byte("{}")
	}
	return methodResponse{
		ID:           method.ID,
		Key:          method.Key,
		Title:        method.Title,
		Description:  method.Description,
		Instructions: method.Instructions,
		Enabled:      method.Enabled,
		PaymentType:  method.PaymentType,
		ConfigJSON:   config,
		SortOrder:    method.SortOrder,
		CreatedAt:    method.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:    method.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func (m *module) handlePublicMethods(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	methods, err := m.store.ListMethods(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list methods error")
		return
	}

	items := make([]methodResponse, 0)
	for _, method := range methods {
		if method.Enabled {
			items = append(items, toMethodResponse(method))
		}
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (m *module) handleAdminMethods(w http.ResponseWriter, r *http.Request) {
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	if r.URL.Path == "/admin/payments/methods" {
		switch r.Method {
		case http.MethodGet:
			m.handleListMethods(w, r)
		case http.MethodPost:
			m.handleCreateMethod(w, r)
		default:
			http.NotFound(w, r)
		}
		return
	}

	if strings.HasPrefix(r.URL.Path, "/admin/payments/methods/") {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/admin/payments/methods/"), "/")
		if len(parts) > 0 && parts[0] != "" {
			methodID := parts[0]
			switch r.Method {
			case http.MethodPut:
				m.handleUpdateMethod(w, r, methodID)
			case http.MethodDelete:
				m.handleDeleteMethod(w, r, methodID)
			default:
				http.NotFound(w, r)
			}
			return
		}
	}

	http.NotFound(w, r)
}

func (m *module) handleListMethods(w http.ResponseWriter, r *http.Request) {
	methods, err := m.store.ListMethods(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list methods error")
		return
	}
	items := make([]methodResponse, 0, len(methods))
	for _, method := range methods {
		items = append(items, toMethodResponse(method))
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (m *module) handleCreateMethod(w http.ResponseWriter, r *http.Request) {
	var req methodRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Key == "" {
		platformhttp.Error(w, http.StatusBadRequest, "key is required")
		return
	}
	if req.Title == "" {
		platformhttp.Error(w, http.StatusBadRequest, "title is required")
		return
	}

	// Check if method with this key already exists
	existing, err := m.store.GetMethodByKey(r.Context(), req.Key)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		platformhttp.Error(w, http.StatusInternalServerError, "check existing error")
		return
	}
	if existing != nil {
		platformhttp.Error(w, http.StatusConflict, "method with this key already exists")
		return
	}

	if req.PaymentType == "" {
		req.PaymentType = "manual"
	}

	if req.ConfigJSON == nil {
		req.ConfigJSON = []byte("{}")
	}

	method := storpayments.PaymentMethod{
		Key:          req.Key,
		Title:        req.Title,
		Description:  req.Description,
		Instructions: req.Instructions,
		Enabled:      req.Enabled,
		PaymentType:  req.PaymentType,
		ConfigJSON:   req.ConfigJSON,
		SortOrder:    req.SortOrder,
	}

	id, err := m.store.CreateMethod(r.Context(), method)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "create method error")
		return
	}

	created, err := m.store.GetMethod(r.Context(), id)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get method error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusCreated, toMethodResponse(*created))
}

func (m *module) handleUpdateMethod(w http.ResponseWriter, r *http.Request, methodID string) {
	var req methodRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Key == "" {
		platformhttp.Error(w, http.StatusBadRequest, "key is required")
		return
	}
	if req.Title == "" {
		platformhttp.Error(w, http.StatusBadRequest, "title is required")
		return
	}

	if req.PaymentType == "" {
		req.PaymentType = "manual"
	}

	if req.ConfigJSON == nil {
		req.ConfigJSON = []byte("{}")
	}

	method := storpayments.PaymentMethod{
		ID:           methodID,
		Key:          req.Key,
		Title:        req.Title,
		Description:  req.Description,
		Instructions: req.Instructions,
		Enabled:      req.Enabled,
		PaymentType:  req.PaymentType,
		ConfigJSON:   req.ConfigJSON,
		SortOrder:    req.SortOrder,
	}

	if err := m.store.UpdateMethod(r.Context(), method); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			platformhttp.Error(w, http.StatusNotFound, "method not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "update method error")
		return
	}

	updated, err := m.store.GetMethod(r.Context(), methodID)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "get method error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, toMethodResponse(*updated))
}

func (m *module) handleDeleteMethod(w http.ResponseWriter, r *http.Request, methodID string) {
	if err := m.store.DeleteMethod(r.Context(), methodID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			platformhttp.Error(w, http.StatusNotFound, "method not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "delete method error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
