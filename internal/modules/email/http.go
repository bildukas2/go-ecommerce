package email

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storemail "goecommerce/internal/storage/email"
)

type updateSettingsRequest struct {
	Driver       string `json:"driver"`
	SMTPHost     string `json:"smtp_host"`
	SMTPPort     int    `json:"smtp_port"`
	SMTPUsername string `json:"smtp_username"`
	SMTPPassword string `json:"smtp_password"`
	FromName     string `json:"from_name"`
	FromEmail    string `json:"from_email"`
}

type testEmailRequest struct {
	To   string `json:"to"`
	Lang string `json:"lang"`
}

type updateTemplateRequest struct {
	SubjectI18n  map[string]string `json:"subject_i18n"`
	BodyHTMLI18n map[string]string `json:"body_html_i18n"`
}

func (m *module) handleAdminSettings(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/admin/email/settings" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	switch r.Method {
	case http.MethodGet:
		item, err := m.store.GetSettings(r.Context())
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "get settings error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, item)
	case http.MethodPut:
		var req updateSettingsRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		in, err := validateUpdateSettingsRequest(req)
		if err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := m.store.UpdateSettings(r.Context(), in)
		if err != nil {
			if errors.Is(err, storemail.ErrNotFound) {
				platformhttp.Error(w, http.StatusNotFound, "not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "update settings error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, item)
	default:
		http.NotFound(w, r)
	}
}

func (m *module) handleAdminSettingsTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/admin/email/settings/test" {
		http.NotFound(w, r)
		return
	}
	if m.service == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "email service unavailable")
		return
	}

	var req testEmailRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	to := strings.ToLower(strings.TrimSpace(req.To))
	lang := normalizeLang(req.Lang)
	if to == "" {
		platformhttp.Error(w, http.StatusBadRequest, "to is required")
		return
	}
	if _, err := mail.ParseAddress(to); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "to must be a valid email")
		return
	}

	if err := m.service.SendTest(r.Context(), to, lang); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "send test email error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (m *module) handleAdminTemplates(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/admin/email/templates" || r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	items, err := m.store.ListTemplates(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list templates error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (m *module) handleAdminTemplateByCode(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/admin/email/templates/") {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	code := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/admin/email/templates/"))
	if code == "" || strings.Contains(code, "/") {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		item, err := m.store.GetTemplateByCode(r.Context(), code)
		if err != nil {
			if errors.Is(err, storemail.ErrNotFound) {
				platformhttp.Error(w, http.StatusNotFound, "not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "get template error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, item)
	case http.MethodPut:
		var req updateTemplateRequest
		if err := decodeRequest(r, &req); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		in, err := validateUpdateTemplateRequest(req)
		if err != nil {
			platformhttp.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := m.store.UpdateTemplateByCode(r.Context(), code, in)
		if err != nil {
			if errors.Is(err, storemail.ErrNotFound) {
				platformhttp.Error(w, http.StatusNotFound, "not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "update template error")
			return
		}
		_ = platformhttp.JSON(w, http.StatusOK, item)
	default:
		http.NotFound(w, r)
	}
}

func validateUpdateSettingsRequest(req updateSettingsRequest) (storemail.UpdateSettingsInput, error) {
	driver := strings.ToLower(strings.TrimSpace(req.Driver))
	switch driver {
	case "mailpit", "smtp":
	default:
		return storemail.UpdateSettingsInput{}, errors.New("driver must be one of: mailpit, smtp")
	}

	fromName := strings.TrimSpace(req.FromName)
	if fromName == "" {
		return storemail.UpdateSettingsInput{}, errors.New("from_name is required")
	}

	fromEmail := strings.ToLower(strings.TrimSpace(req.FromEmail))
	if fromEmail == "" {
		return storemail.UpdateSettingsInput{}, errors.New("from_email is required")
	}
	if _, err := mail.ParseAddress(fromEmail); err != nil {
		return storemail.UpdateSettingsInput{}, errors.New("from_email must be a valid email")
	}

	host := strings.TrimSpace(req.SMTPHost)
	port := req.SMTPPort
	username := strings.TrimSpace(req.SMTPUsername)
	password := req.SMTPPassword

	if driver == "smtp" {
		if host == "" {
			return storemail.UpdateSettingsInput{}, errors.New("smtp_host is required when driver=smtp")
		}
		if port <= 0 || port > 65535 {
			return storemail.UpdateSettingsInput{}, errors.New("smtp_port must be between 1 and 65535")
		}
		if username == "" {
			return storemail.UpdateSettingsInput{}, errors.New("smtp_username is required when driver=smtp")
		}
		if strings.TrimSpace(password) == "" {
			return storemail.UpdateSettingsInput{}, errors.New("smtp_password is required when driver=smtp")
		}
	} else {
		if host == "" {
			host = "localhost"
		}
		if port <= 0 || port > 65535 {
			port = 1025
		}
	}

	return storemail.UpdateSettingsInput{
		Driver:       driver,
		SMTPHost:     host,
		SMTPPort:     port,
		SMTPUsername: username,
		SMTPPassword: password,
		FromName:     fromName,
		FromEmail:    fromEmail,
	}, nil
}

func validateUpdateTemplateRequest(req updateTemplateRequest) (storemail.UpdateTemplateInput, error) {
	subjectI18n := normalizeI18nMap(req.SubjectI18n)
	bodyHTMLI18n := normalizeI18nMap(req.BodyHTMLI18n)

	if strings.TrimSpace(subjectI18n["en"]) == "" {
		return storemail.UpdateTemplateInput{}, errors.New("subject_i18n.en is required")
	}
	if strings.TrimSpace(bodyHTMLI18n["en"]) == "" {
		return storemail.UpdateTemplateInput{}, errors.New("body_html_i18n.en is required")
	}

	return storemail.UpdateTemplateInput{
		SubjectI18n:  subjectI18n,
		BodyHTMLI18n: bodyHTMLI18n,
	}, nil
}

func normalizeI18nMap(in map[string]string) map[string]string {
	if len(in) == 0 {
		return map[string]string{}
	}
	out := make(map[string]string, len(in))
	for key, value := range in {
		normalizedKey := normalizeLang(key)
		if normalizedKey == "" {
			continue
		}
		out[normalizedKey] = strings.TrimSpace(value)
	}
	return out
}

func normalizeLang(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
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
