package admin

import (
	"errors"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storcat "goecommerce/internal/storage/catalog"
)

type upsertCustomOptionRequest struct {
	StoreID    *string                        `json:"store_id"`
	Code       string                         `json:"code"`
	Title      string                         `json:"title"`
	TypeGroup  string                         `json:"type_group"`
	Type       string                         `json:"type"`
	Required   bool                           `json:"required"`
	SortOrder  *int                           `json:"sort_order"`
	PriceType  *string                        `json:"price_type"`
	PriceValue *float64                       `json:"price_value"`
	IsActive   *bool                          `json:"is_active"`
	Values     []upsertCustomOptionValueInput `json:"values"`
}

type upsertCustomOptionValueInput struct {
	Title      string   `json:"title"`
	SKU        *string  `json:"sku"`
	SortOrder  *int     `json:"sort_order"`
	PriceType  string   `json:"price_type"`
	PriceValue *float64 `json:"price_value"`
	IsDefault  bool     `json:"is_default"`
}

type attachProductCustomOptionRequest struct {
	OptionID  string `json:"option_id"`
	SortOrder *int   `json:"sort_order"`
}

type productCustomOptionAssignmentResponse struct {
	ProductID string                       `json:"product_id"`
	OptionID  string                       `json:"option_id"`
	SortOrder int                          `json:"sort_order"`
	Option    *storcat.ProductCustomOption `json:"option,omitempty"`
}

func (m *module) handleCustomOptions(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/admin/custom-options" {
		http.NotFound(w, r)
		return
	}
	if m.catalog == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		params := storcat.ListCustomOptionsParams{
			Query:     strings.TrimSpace(firstNonEmpty(r.URL.Query().Get("q"), r.URL.Query().Get("search"))),
			TypeGroup: strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type_group"))),
		}
		items, err := m.catalog.ListCustomOptions(r.Context(), params)
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "list custom options error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
	case http.MethodPost:
		var req upsertCustomOptionRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		in, err := validateCustomOptionRequest(req)
		if err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := m.catalog.CreateCustomOption(r.Context(), in)
		if err != nil {
			writeCustomOptionStoreError(w, err, "create custom option error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusCreated, item)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleCustomOptionDetail(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/admin/custom-options/") {
		http.NotFound(w, r)
		return
	}
	if m.catalog == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	id := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/admin/custom-options/"))
	if id == "" || strings.Contains(id, "/") {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		item, err := m.catalog.GetCustomOptionByID(r.Context(), id)
		if err != nil {
			writeCustomOptionStoreError(w, err, "get custom option error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, item)
	case http.MethodPut:
		var req upsertCustomOptionRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		in, err := validateCustomOptionRequest(req)
		if err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := m.catalog.UpdateCustomOption(r.Context(), id, in)
		if err != nil {
			writeCustomOptionStoreError(w, err, "update custom option error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, item)
	case http.MethodDelete:
		if err := m.catalog.DeleteCustomOption(r.Context(), id); err != nil {
			if errors.Is(err, storcat.ErrConflict) {
				platformhttp.Error(w, http.StatusConflict, "option is assigned to products")
				return
			}
			writeCustomOptionStoreError(w, err, "delete custom option error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"id": id})
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleProductCustomOptionAssignments(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/admin/products/") {
		http.NotFound(w, r)
		return
	}
	if m.catalog == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/admin/products/"), "/")
	if len(parts) < 2 {
		http.NotFound(w, r)
		return
	}
	productID := strings.TrimSpace(parts[0])
	resource := strings.TrimSpace(parts[1])
	if productID == "" || resource != "custom-options" {
		http.NotFound(w, r)
		return
	}

	if len(parts) == 2 {
		switch r.Method {
		case http.MethodGet:
			assignments, err := m.catalog.ListProductCustomOptionAssignments(r.Context(), productID)
			if err != nil {
				writeCustomOptionStoreError(w, err, "list product custom options error")
				return
			}
			items := make([]productCustomOptionAssignmentResponse, 0, len(assignments))
			for _, assignment := range assignments {
				option, err := m.catalog.GetCustomOptionByID(r.Context(), assignment.OptionID)
				if err != nil {
					writeCustomOptionStoreError(w, err, "list product custom options error")
					return
				}
				optionCopy := option
				items = append(items, productCustomOptionAssignmentResponse{
					ProductID: assignment.ProductID,
					OptionID:  assignment.OptionID,
					SortOrder: assignment.SortOrder,
					Option:    &optionCopy,
				})
			}
			_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
		case http.MethodPost:
			var req attachProductCustomOptionRequest
			if err := decodeRequest(r, &req); err != nil {
				platformhttp.Error(w, http.StatusBadRequest, err.Error())
				return
			}
			optionID := strings.TrimSpace(req.OptionID)
			if optionID == "" {
				platformhttp.Error(w, http.StatusBadRequest, "option_id is required")
				return
			}
			assignment, err := m.catalog.AttachProductCustomOption(r.Context(), productID, optionID, req.SortOrder)
			if err != nil {
				writeCustomOptionStoreError(w, err, "attach custom option error")
				return
			}
			_ = platformhttp.JSON(w, http.StatusCreated, assignment)
		default:
			http.NotFound(w, r)
		}
		return
	}

	if len(parts) == 3 && r.Method == http.MethodDelete {
		optionID := strings.TrimSpace(parts[2])
		if optionID == "" {
			http.NotFound(w, r)
			return
		}
		if err := m.catalog.DetachProductCustomOption(r.Context(), productID, optionID); err != nil {
			writeCustomOptionStoreError(w, err, "detach custom option error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
			"product_id": productID,
			"option_id":  optionID,
		})
		return
	}

	http.NotFound(w, r)
}

func validateCustomOptionRequest(req upsertCustomOptionRequest) (storcat.CustomOptionUpsertInput, error) {
	title := strings.TrimSpace(req.Title)
	if len(title) < 2 {
		return storcat.CustomOptionUpsertInput{}, errors.New("title must be at least 2 characters")
	}
	code := strings.TrimSpace(req.Code)
	if code == "" {
		return storcat.CustomOptionUpsertInput{}, errors.New("code is required")
	}

	typeGroup := strings.ToLower(strings.TrimSpace(req.TypeGroup))
	if !isValidCustomOptionTypeGroup(typeGroup) {
		return storcat.CustomOptionUpsertInput{}, errors.New("invalid type_group")
	}
	optionType := strings.ToLower(strings.TrimSpace(req.Type))
	if !isValidCustomOptionType(typeGroup, optionType) {
		return storcat.CustomOptionUpsertInput{}, errors.New("invalid type for type_group")
	}

	values := make([]storcat.CustomOptionValueUpsertInput, 0, len(req.Values))
	for _, valueReq := range req.Values {
		value, err := validateCustomOptionValueRequest(valueReq)
		if err != nil {
			return storcat.CustomOptionUpsertInput{}, err
		}
		values = append(values, value)
	}

	if typeGroup == storcat.CustomOptionTypeGroupSelect {
		if len(values) == 0 {
			return storcat.CustomOptionUpsertInput{}, errors.New("select options must include at least one value")
		}
	} else {
		if len(values) > 0 {
			return storcat.CustomOptionUpsertInput{}, errors.New("non-select options cannot include values")
		}
		priceType, err := normalizeCustomOptionPriceType(req.PriceType)
		if err != nil {
			return storcat.CustomOptionUpsertInput{}, err
		}
		if req.PriceValue == nil {
			return storcat.CustomOptionUpsertInput{}, errors.New("price_value is required")
		}
		if *req.PriceValue < 0 {
			return storcat.CustomOptionUpsertInput{}, errors.New("price_value must be >= 0")
		}
		req.PriceType = &priceType
	}

	return storcat.CustomOptionUpsertInput{
		StoreID:    normalizeOptionalString(req.StoreID),
		Code:       code,
		Title:      title,
		TypeGroup:  typeGroup,
		Type:       optionType,
		Required:   req.Required,
		SortOrder:  req.SortOrder,
		PriceType:  req.PriceType,
		PriceValue: req.PriceValue,
		IsActive:   req.IsActive,
		Values:     values,
	}, nil
}

func validateCustomOptionValueRequest(req upsertCustomOptionValueInput) (storcat.CustomOptionValueUpsertInput, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return storcat.CustomOptionValueUpsertInput{}, errors.New("value title is required")
	}
	priceType, err := normalizeCustomOptionPriceType(&req.PriceType)
	if err != nil {
		return storcat.CustomOptionValueUpsertInput{}, err
	}
	if req.PriceValue == nil {
		return storcat.CustomOptionValueUpsertInput{}, errors.New("value price_value is required")
	}
	if *req.PriceValue < 0 {
		return storcat.CustomOptionValueUpsertInput{}, errors.New("value price_value must be >= 0")
	}
	return storcat.CustomOptionValueUpsertInput{
		Title:      title,
		SKU:        normalizeOptionalString(req.SKU),
		SortOrder:  req.SortOrder,
		PriceType:  priceType,
		PriceValue: req.PriceValue,
		IsDefault:  req.IsDefault,
	}, nil
}

func normalizeCustomOptionPriceType(priceType *string) (string, error) {
	if priceType == nil || strings.TrimSpace(*priceType) == "" {
		return "", errors.New("price_type is required")
	}
	normalized := strings.ToLower(strings.TrimSpace(*priceType))
	if normalized != storcat.CustomOptionPriceTypeFixed && normalized != storcat.CustomOptionPriceTypePercent {
		return "", errors.New("price_type must be fixed or percent")
	}
	return normalized, nil
}

func isValidCustomOptionTypeGroup(typeGroup string) bool {
	switch typeGroup {
	case storcat.CustomOptionTypeGroupText, storcat.CustomOptionTypeGroupFile, storcat.CustomOptionTypeGroupSelect, storcat.CustomOptionTypeGroupDate:
		return true
	default:
		return false
	}
}

func isValidCustomOptionType(typeGroup, optionType string) bool {
	switch typeGroup {
	case storcat.CustomOptionTypeGroupText:
		return optionType == "field" || optionType == "area"
	case storcat.CustomOptionTypeGroupFile:
		return optionType == "file"
	case storcat.CustomOptionTypeGroupSelect:
		return optionType == "dropdown" || optionType == "radio" || optionType == "checkbox" || optionType == "multiple"
	case storcat.CustomOptionTypeGroupDate:
		return optionType == "date" || optionType == "datetime" || optionType == "time"
	default:
		return false
	}
}

func writeCustomOptionStoreError(w http.ResponseWriter, err error, fallbackMessage string) {
	switch {
	case errors.Is(err, storcat.ErrInvalidInput):
		msg := strings.TrimPrefix(err.Error(), storcat.ErrInvalidInput.Error()+": ")
		if msg == "" {
			msg = "invalid request"
		}
		platformhttp.Error(w, http.StatusBadRequest, msg)
	case errors.Is(err, storcat.ErrNotFound):
		platformhttp.Error(w, http.StatusNotFound, "not found")
	case errors.Is(err, storcat.ErrConflict):
		platformhttp.Error(w, http.StatusConflict, "conflict")
	default:
		platformhttp.Error(w, http.StatusInternalServerError, fallbackMessage)
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
