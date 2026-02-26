package email

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	storemail "goecommerce/internal/storage/email"
)

type httpFakeStore struct {
	getSettingsFunc       func(ctx context.Context) (storemail.Settings, error)
	updateSettingsFunc    func(ctx context.Context, in storemail.UpdateSettingsInput) (storemail.Settings, error)
	listTemplatesFunc     func(ctx context.Context) ([]storemail.Template, error)
	getTemplateByCodeFunc func(ctx context.Context, code string) (storemail.Template, error)
	updateTemplateByCode  func(ctx context.Context, code string, in storemail.UpdateTemplateInput) (storemail.Template, error)
}

func (f *httpFakeStore) GetSettings(ctx context.Context) (storemail.Settings, error) {
	if f.getSettingsFunc != nil {
		return f.getSettingsFunc(ctx)
	}
	return storemail.Settings{}, nil
}

func (f *httpFakeStore) UpdateSettings(ctx context.Context, in storemail.UpdateSettingsInput) (storemail.Settings, error) {
	if f.updateSettingsFunc != nil {
		return f.updateSettingsFunc(ctx, in)
	}
	return storemail.Settings{}, nil
}

func (f *httpFakeStore) ListTemplates(ctx context.Context) ([]storemail.Template, error) {
	if f.listTemplatesFunc != nil {
		return f.listTemplatesFunc(ctx)
	}
	return []storemail.Template{}, nil
}

func (f *httpFakeStore) GetTemplateByCode(ctx context.Context, code string) (storemail.Template, error) {
	if f.getTemplateByCodeFunc != nil {
		return f.getTemplateByCodeFunc(ctx, code)
	}
	return storemail.Template{}, nil
}

func (f *httpFakeStore) UpdateTemplateByCode(ctx context.Context, code string, in storemail.UpdateTemplateInput) (storemail.Template, error) {
	if f.updateTemplateByCode != nil {
		return f.updateTemplateByCode(ctx, code, in)
	}
	return storemail.Template{}, nil
}

type httpFakeService struct {
	sendTestFunc func(ctx context.Context, to, lang string) error
}

func (f *httpFakeService) SendTest(ctx context.Context, to, lang string) error {
	if f.sendTestFunc != nil {
		return f.sendTestFunc(ctx, to, lang)
	}
	return nil
}

func TestHandleAdminSettingsGetSuccess(t *testing.T) {
	m := &module{
		store: &httpFakeStore{
			getSettingsFunc: func(context.Context) (storemail.Settings, error) {
				return storemail.Settings{
					Driver:    "mailpit",
					SMTPHost:  "localhost",
					SMTPPort:  1025,
					FromName:  "Store",
					FromEmail: "store@example.com",
				}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/email/settings", nil)
	rr := httptest.NewRecorder()
	m.handleAdminSettings(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var payload map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["driver"] != "mailpit" {
		t.Fatalf("expected driver mailpit, got %v", payload["driver"])
	}
}

func TestHandleAdminSettingsPutRejectsUnknownField(t *testing.T) {
	m := &module{store: &httpFakeStore{}}
	body := `{"driver":"mailpit","from_name":"Store","from_email":"store@example.com","unknown":"x"}`
	req := httptest.NewRequest(http.MethodPut, "/admin/email/settings", strings.NewReader(body))
	rr := httptest.NewRecorder()

	m.handleAdminSettings(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestHandleAdminSettingsPutValidatesSMTPFields(t *testing.T) {
	m := &module{store: &httpFakeStore{}}
	body := `{"driver":"smtp","smtp_host":"","smtp_port":587,"smtp_username":"user","smtp_password":"pass","from_name":"Store","from_email":"store@example.com"}`
	req := httptest.NewRequest(http.MethodPut, "/admin/email/settings", strings.NewReader(body))
	rr := httptest.NewRecorder()

	m.handleAdminSettings(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
	var payload map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &payload)
	if payload["error"] != "smtp_host is required when driver=smtp" {
		t.Fatalf("unexpected error: %v", payload["error"])
	}
}

func TestHandleAdminSettingsPutSuccess(t *testing.T) {
	var captured storemail.UpdateSettingsInput
	m := &module{
		store: &httpFakeStore{
			updateSettingsFunc: func(ctx context.Context, in storemail.UpdateSettingsInput) (storemail.Settings, error) {
				captured = in
				return storemail.Settings{
					Driver:       in.Driver,
					SMTPHost:     in.SMTPHost,
					SMTPPort:     in.SMTPPort,
					SMTPUsername: in.SMTPUsername,
					SMTPPassword: in.SMTPPassword,
					FromName:     in.FromName,
					FromEmail:    in.FromEmail,
					UpdatedAt:    time.Now().UTC(),
				}, nil
			},
		},
	}

	body := `{"driver":"smtp","smtp_host":"smtp.example.com","smtp_port":587,"smtp_username":"  user ","smtp_password":"pass","from_name":" Store ","from_email":" ADMIN@Example.com "}`
	req := httptest.NewRequest(http.MethodPut, "/admin/email/settings", strings.NewReader(body))
	rr := httptest.NewRecorder()

	m.handleAdminSettings(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if captured.SMTPUsername != "user" {
		t.Fatalf("expected trimmed smtp username, got %q", captured.SMTPUsername)
	}
	if captured.FromName != "Store" {
		t.Fatalf("expected trimmed from name, got %q", captured.FromName)
	}
	if captured.FromEmail != "admin@example.com" {
		t.Fatalf("expected normalized from email, got %q", captured.FromEmail)
	}
}

func TestHandleAdminSettingsTestSuccess(t *testing.T) {
	var gotTo, gotLang string
	m := &module{
		service: &httpFakeService{
			sendTestFunc: func(ctx context.Context, to, lang string) error {
				gotTo = to
				gotLang = lang
				return nil
			},
		},
	}

	body := `{"to":" User@Example.com ","lang":" LT "}`
	req := httptest.NewRequest(http.MethodPost, "/admin/email/settings/test", strings.NewReader(body))
	rr := httptest.NewRecorder()

	m.handleAdminSettingsTest(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if gotTo != "user@example.com" {
		t.Fatalf("unexpected recipient: %q", gotTo)
	}
	if gotLang != "lt" {
		t.Fatalf("unexpected lang: %q", gotLang)
	}
}

func TestHandleAdminSettingsTestRejectsInvalidEmail(t *testing.T) {
	m := &module{service: &httpFakeService{}}
	req := httptest.NewRequest(http.MethodPost, "/admin/email/settings/test", strings.NewReader(`{"to":"not-an-email","lang":"en"}`))
	rr := httptest.NewRecorder()

	m.handleAdminSettingsTest(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestHandleAdminTemplatesListSuccess(t *testing.T) {
	m := &module{
		store: &httpFakeStore{
			listTemplatesFunc: func(context.Context) ([]storemail.Template, error) {
				return []storemail.Template{
					{Code: "order_confirmation", Name: "Order Confirmation"},
				}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/email/templates", nil)
	rr := httptest.NewRecorder()
	m.handleAdminTemplates(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var payload struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Items) != 1 {
		t.Fatalf("expected one template, got %d", len(payload.Items))
	}
}

func TestHandleAdminTemplateByCodeGetNotFound(t *testing.T) {
	m := &module{
		store: &httpFakeStore{
			getTemplateByCodeFunc: func(context.Context, string) (storemail.Template, error) {
				return storemail.Template{}, storemail.ErrNotFound
			},
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/admin/email/templates/missing", nil)
	rr := httptest.NewRecorder()

	m.handleAdminTemplateByCode(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}

func TestHandleAdminTemplateByCodePutRequiresEnglish(t *testing.T) {
	m := &module{store: &httpFakeStore{}}
	body := `{"subject_i18n":{"lt":"tema"},"body_html_i18n":{"en":"<p>Body</p>"}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/email/templates/order_confirmation", strings.NewReader(body))
	rr := httptest.NewRecorder()

	m.handleAdminTemplateByCode(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestHandleAdminTemplateByCodePutSuccess(t *testing.T) {
	var gotCode string
	var gotInput storemail.UpdateTemplateInput
	m := &module{
		store: &httpFakeStore{
			updateTemplateByCode: func(ctx context.Context, code string, in storemail.UpdateTemplateInput) (storemail.Template, error) {
				gotCode = code
				gotInput = in
				return storemail.Template{
					Code:         code,
					Name:         "Order Confirmation",
					SubjectI18n:  in.SubjectI18n,
					BodyHTMLI18n: in.BodyHTMLI18n,
				}, nil
			},
		},
	}

	body := `{"subject_i18n":{"EN":" Subject ","LT":"Tema"},"body_html_i18n":{"EN":" <p>Body</p> ","LT":"<p>Kunas</p>"}}`
	req := httptest.NewRequest(http.MethodPut, "/admin/email/templates/order_confirmation", strings.NewReader(body))
	rr := httptest.NewRecorder()

	m.handleAdminTemplateByCode(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if gotCode != "order_confirmation" {
		t.Fatalf("unexpected code: %q", gotCode)
	}
	if gotInput.SubjectI18n["en"] != "Subject" {
		t.Fatalf("expected normalized EN subject, got %q", gotInput.SubjectI18n["en"])
	}
	if gotInput.BodyHTMLI18n["en"] != "<p>Body</p>" {
		t.Fatalf("expected normalized EN body, got %q", gotInput.BodyHTMLI18n["en"])
	}
}

func TestHandleAdminTemplateByCodePutNotFound(t *testing.T) {
	m := &module{
		store: &httpFakeStore{
			updateTemplateByCode: func(context.Context, string, storemail.UpdateTemplateInput) (storemail.Template, error) {
				return storemail.Template{}, storemail.ErrNotFound
			},
		},
	}
	req := httptest.NewRequest(http.MethodPut, "/admin/email/templates/order_confirmation", strings.NewReader(`{"subject_i18n":{"en":"ok"},"body_html_i18n":{"en":"ok"}}`))
	rr := httptest.NewRecorder()

	m.handleAdminTemplateByCode(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
}

func TestHandleAdminSettingsTestServiceFailure(t *testing.T) {
	m := &module{
		service: &httpFakeService{
			sendTestFunc: func(context.Context, string, string) error {
				return errors.New("boom")
			},
		},
	}
	req := httptest.NewRequest(http.MethodPost, "/admin/email/settings/test", strings.NewReader(`{"to":"user@example.com","lang":"en"}`))
	rr := httptest.NewRecorder()

	m.handleAdminSettingsTest(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rr.Code)
	}
}
