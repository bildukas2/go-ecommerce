package email

import (
	"context"
	"strings"
	"testing"

	platformemail "goecommerce/internal/platform/email"
	storemail "goecommerce/internal/storage/email"
)

func TestServiceSendOrderConfirmationLanguageFallback(t *testing.T) {
	store := &fakeStore{
		settings: defaultSettings(),
		template: storemail.Template{
			Code:        "order_confirmation",
			SubjectI18n: map[string]string{"en": "Order {{.OrderNumber}}", "lt": "Uzsakymas {{.OrderNumber}}"},
			BodyHTMLI18n: map[string]string{
				"en": "<p>EN {{.OrderNumber}}</p>",
				"lt": "<p>LT {{.OrderNumber}}</p>",
			},
		},
	}
	sent := &captureSender{}
	svc := NewServiceWithConfig(store, platformemail.Config{}, func(cfg platformemail.Config) (platformemail.Sender, error) {
		return sent, nil
	})

	err := svc.SendOrderConfirmation(context.Background(), "customer@example.com", "lv", map[string]any{"OrderNumber": "ORD-1"})
	if err != nil {
		t.Fatalf("send order confirmation: %v", err)
	}
	if sent.msg.Subject != "Order ORD-1" {
		t.Fatalf("expected EN fallback subject, got %q", sent.msg.Subject)
	}
	if sent.msg.HTMLBody != "<p>EN ORD-1</p>" {
		t.Fatalf("expected EN fallback body, got %q", sent.msg.HTMLBody)
	}
}

func TestServiceSendOrderConfirmationMissingEnglishTemplate(t *testing.T) {
	store := &fakeStore{
		settings: defaultSettings(),
		template: storemail.Template{
			Code:        "order_confirmation",
			SubjectI18n: map[string]string{"lt": "Uzsakymas {{.OrderNumber}}"},
			BodyHTMLI18n: map[string]string{
				"lt": "<p>LT {{.OrderNumber}}</p>",
			},
		},
	}
	svc := NewServiceWithConfig(store, platformemail.Config{}, func(cfg platformemail.Config) (platformemail.Sender, error) {
		return &captureSender{}, nil
	})

	err := svc.SendOrderConfirmation(context.Background(), "customer@example.com", "lv", map[string]any{"OrderNumber": "ORD-1"})
	if err == nil || !strings.Contains(err.Error(), "missing required English template") {
		t.Fatalf("expected missing english template error, got %v", err)
	}
}

func TestServiceSendOrderConfirmationRenderError(t *testing.T) {
	store := &fakeStore{
		settings: defaultSettings(),
		template: storemail.Template{
			Code:        "order_confirmation",
			SubjectI18n: map[string]string{"en": "Order {{.MissingKey}}"},
			BodyHTMLI18n: map[string]string{
				"en": "<p>Hello</p>",
			},
		},
	}
	svc := NewServiceWithConfig(store, platformemail.Config{}, func(cfg platformemail.Config) (platformemail.Sender, error) {
		return &captureSender{}, nil
	})

	err := svc.SendOrderConfirmation(context.Background(), "customer@example.com", "en", map[string]any{"OrderNumber": "ORD-1"})
	if err == nil || !strings.Contains(err.Error(), "render subject template") {
		t.Fatalf("expected render template error, got %v", err)
	}
}

func TestServiceSendOrderConfirmationSuccess(t *testing.T) {
	store := &fakeStore{
		settings: defaultSettings(),
		template: storemail.Template{
			Code:        "order_confirmation",
			SubjectI18n: map[string]string{"en": "Order {{.OrderNumber}}"},
			BodyHTMLI18n: map[string]string{
				"en": "<h1>{{.OrderNumber}}</h1>",
			},
		},
	}
	sent := &captureSender{}
	svc := NewServiceWithConfig(store, platformemail.Config{}, func(cfg platformemail.Config) (platformemail.Sender, error) {
		if cfg.Driver != "smtp" {
			t.Fatalf("expected persisted driver smtp, got %q", cfg.Driver)
		}
		if cfg.FromEmail != "store@example.com" {
			t.Fatalf("expected persisted from email, got %q", cfg.FromEmail)
		}
		return sent, nil
	})

	err := svc.SendOrderConfirmation(context.Background(), "customer@example.com", "en", map[string]any{"OrderNumber": "ORD-2"})
	if err != nil {
		t.Fatalf("send order confirmation: %v", err)
	}
	if sent.msg.To != "customer@example.com" {
		t.Fatalf("unexpected recipient: %q", sent.msg.To)
	}
	if sent.msg.Subject != "Order ORD-2" {
		t.Fatalf("unexpected subject: %q", sent.msg.Subject)
	}
	if sent.msg.HTMLBody != "<h1>ORD-2</h1>" {
		t.Fatalf("unexpected body: %q", sent.msg.HTMLBody)
	}
}

func TestServiceSendTestUsesDefaultPayload(t *testing.T) {
	store := &fakeStore{
		settings: defaultSettings(),
		template: storemail.Template{
			Code:        "order_confirmation",
			SubjectI18n: map[string]string{"en": "Order {{.OrderNumber}}"},
			BodyHTMLI18n: map[string]string{
				"en": "<p>{{.OrderNumber}}</p>",
			},
		},
	}
	sent := &captureSender{}
	svc := NewServiceWithConfig(store, platformemail.Config{}, func(cfg platformemail.Config) (platformemail.Sender, error) {
		return sent, nil
	})

	err := svc.SendTest(context.Background(), "customer@example.com", "en")
	if err != nil {
		t.Fatalf("send test: %v", err)
	}
	if sent.msg.Subject != "Order TEST-ORDER" {
		t.Fatalf("unexpected test subject: %q", sent.msg.Subject)
	}
}

type fakeStore struct {
	template    storemail.Template
	settings    storemail.Settings
	templateErr error
	settingsErr error
}

func (f *fakeStore) GetTemplateByCode(context.Context, string) (storemail.Template, error) {
	if f.templateErr != nil {
		return storemail.Template{}, f.templateErr
	}
	return f.template, nil
}

func (f *fakeStore) GetSettings(context.Context) (storemail.Settings, error) {
	if f.settingsErr != nil {
		return storemail.Settings{}, f.settingsErr
	}
	return f.settings, nil
}

type captureSender struct {
	msg platformemail.Message
	err error
}

func (c *captureSender) Send(_ context.Context, msg platformemail.Message) error {
	if c.err != nil {
		return c.err
	}
	c.msg = msg
	return nil
}

func defaultSettings() storemail.Settings {
	return storemail.Settings{
		Driver:       "smtp",
		SMTPHost:     "smtp.example.com",
		SMTPPort:     587,
		SMTPUsername: "user",
		SMTPPassword: "secret",
		FromName:     "Store",
		FromEmail:    "store@example.com",
	}
}
