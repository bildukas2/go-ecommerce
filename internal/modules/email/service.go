package email

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"text/template"
	"time"

	platformemail "goecommerce/internal/platform/email"
	storemail "goecommerce/internal/storage/email"
)

const orderConfirmationTemplateCode = "order_confirmation"
const testTemplateCode = "test"
const passwordResetTemplateCode = "password_reset"

type Store interface {
	GetSettings(ctx context.Context) (storemail.Settings, error)
	GetTemplateByCode(ctx context.Context, code string) (storemail.Template, error)
}

type SenderFactory func(cfg platformemail.Config) (platformemail.Sender, error)

type Service struct {
	store         Store
	envConfig     platformemail.Config
	senderFactory SenderFactory
}

func NewService(store Store) *Service {
	return NewServiceWithConfig(store, platformemail.ConfigFromEnv(), platformemail.NewSenderFromConfig)
}

func NewServiceWithConfig(store Store, envConfig platformemail.Config, senderFactory SenderFactory) *Service {
	if senderFactory == nil {
		senderFactory = platformemail.NewSenderFromConfig
	}
	return &Service{store: store, envConfig: envConfig, senderFactory: senderFactory}
}

func (s *Service) SendTest(ctx context.Context, to, lang string) error {
	data := map[string]any{
		"StoreName": "Go Ecommerce",
		"SentAt":    time.Now().Format("2006-01-02 15:04:05"),
	}
	return s.sendTemplate(ctx, testTemplateCode, to, lang, data)
}

func (s *Service) SendPasswordReset(ctx context.Context, to, lang string, resetURL string) error {
	data := map[string]any{
		"ResetURL": resetURL,
	}
	return s.sendTemplate(ctx, passwordResetTemplateCode, to, lang, data)
}

func (s *Service) SendOrderConfirmation(ctx context.Context, to, lang string, data map[string]any) error {
	if data == nil {
		data = map[string]any{}
	}
	return s.sendTemplate(ctx, orderConfirmationTemplateCode, to, lang, data)
}

func (s *Service) sendTemplate(ctx context.Context, code, to, lang string, data map[string]any) error {
	if s == nil || s.store == nil {
		return errors.New("email service unavailable")
	}
	to = strings.TrimSpace(strings.ToLower(to))
	if to == "" {
		return errors.New("recipient email is required")
	}
	if _, err := mail.ParseAddress(to); err != nil {
		return fmt.Errorf("invalid recipient email: %w", err)
	}

	tpl, err := s.store.GetTemplateByCode(ctx, strings.TrimSpace(code))
	if err != nil {
		if errors.Is(err, storemail.ErrNotFound) {
			return fmt.Errorf("template %q not found", code)
		}
		return fmt.Errorf("load template %q: %w", code, err)
	}

	subjectSource, err := resolveI18n(tpl.SubjectI18n, lang)
	if err != nil {
		return fmt.Errorf("resolve subject template: %w", err)
	}
	bodySource, err := resolveI18n(tpl.BodyHTMLI18n, lang)
	if err != nil {
		return fmt.Errorf("resolve body template: %w", err)
	}

	subject, err := renderTemplate(subjectSource, data)
	if err != nil {
		return fmt.Errorf("render subject template: %w", err)
	}
	body, err := renderTemplate(bodySource, data)
	if err != nil {
		return fmt.Errorf("render body template: %w", err)
	}

	settings, err := s.store.GetSettings(ctx)
	if err != nil {
		if errors.Is(err, storemail.ErrNotFound) {
			return errors.New("email settings not configured")
		}
		return fmt.Errorf("load email settings: %w", err)
	}

	cfg := platformemail.MergeConfig(s.envConfig, platformemail.Config{
		Driver:       settings.Driver,
		SMTPHost:     settings.SMTPHost,
		SMTPPort:     settings.SMTPPort,
		SMTPUsername: settings.SMTPUsername,
		SMTPPassword: settings.SMTPPassword,
		FromName:     settings.FromName,
		FromEmail:    settings.FromEmail,
	})

	sender, err := s.senderFactory(cfg)
	if err != nil {
		return fmt.Errorf("build email sender: %w", err)
	}

	if err := sender.Send(ctx, platformemail.Message{
		To:       to,
		Subject:  subject,
		HTMLBody: body,
	}); err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	return nil
}

func resolveI18n(values map[string]string, lang string) (string, error) {
	lang = strings.ToLower(strings.TrimSpace(lang))
	if lang != "" {
		if val := strings.TrimSpace(values[lang]); val != "" {
			return val, nil
		}
	}
	if fallback := strings.TrimSpace(values["en"]); fallback != "" {
		return fallback, nil
	}
	return "", errors.New("missing required English template")
}

func renderTemplate(raw string, data map[string]any) (string, error) {
	tmpl, err := template.New("email").Option("missingkey=error").Parse(raw)
	if err != nil {
		return "", err
	}
	var out bytes.Buffer
	if err := tmpl.Execute(&out, data); err != nil {
		return "", err
	}
	return out.String(), nil
}
