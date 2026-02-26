package email

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"

	platformdb "goecommerce/internal/platform/db"
)

func TestStore_GetAndUpdateSettings(t *testing.T) {
	store, db := newTestStore(t)
	defer db.Close()
	defer store.Close()

	ctx := context.Background()
	original, err := store.GetSettings(ctx)
	if err != nil {
		t.Fatalf("get settings: %v", err)
	}

	t.Cleanup(func() {
		_, restoreErr := store.UpdateSettings(ctx, UpdateSettingsInput{
			Driver:       original.Driver,
			SMTPHost:     original.SMTPHost,
			SMTPPort:     original.SMTPPort,
			SMTPUsername: original.SMTPUsername,
			SMTPPassword: original.SMTPPassword,
			FromName:     original.FromName,
			FromEmail:    original.FromEmail,
		})
		if restoreErr != nil {
			t.Fatalf("restore settings: %v", restoreErr)
		}
	})

	updated, err := store.UpdateSettings(ctx, UpdateSettingsInput{
		Driver:       "smtp",
		SMTPHost:     "smtp.test.local",
		SMTPPort:     2525,
		SMTPUsername: "smtp-user",
		SMTPPassword: "smtp-pass",
		FromName:     "Store QA",
		FromEmail:    "qa@example.com",
	})
	if err != nil {
		t.Fatalf("update settings: %v", err)
	}

	if updated.Driver != "smtp" {
		t.Fatalf("expected driver smtp, got %q", updated.Driver)
	}
	if updated.SMTPHost != "smtp.test.local" {
		t.Fatalf("expected smtp host updated, got %q", updated.SMTPHost)
	}
	if updated.FromEmail != "qa@example.com" {
		t.Fatalf("expected from email updated, got %q", updated.FromEmail)
	}

	reloaded, err := store.GetSettings(ctx)
	if err != nil {
		t.Fatalf("reload settings: %v", err)
	}
	if reloaded.Driver != updated.Driver {
		t.Fatalf("expected reloaded driver %q, got %q", updated.Driver, reloaded.Driver)
	}
	if reloaded.SMTPPort != updated.SMTPPort {
		t.Fatalf("expected reloaded smtp port %d, got %d", updated.SMTPPort, reloaded.SMTPPort)
	}
}

func TestStore_ListGetAndUpdateTemplates(t *testing.T) {
	store, db := newTestStore(t)
	defer db.Close()
	defer store.Close()

	ctx := context.Background()
	templates, err := store.ListTemplates(ctx)
	if err != nil {
		t.Fatalf("list templates: %v", err)
	}
	if len(templates) < 3 {
		t.Fatalf("expected seeded templates, got %d", len(templates))
	}

	tpl, err := store.GetTemplateByCode(ctx, "order_confirmation")
	if err != nil {
		t.Fatalf("get template by code: %v", err)
	}
	originalSubject := cloneMap(tpl.SubjectI18n)
	originalBody := cloneMap(tpl.BodyHTMLI18n)

	t.Cleanup(func() {
		_, restoreErr := store.UpdateTemplateByCode(ctx, tpl.Code, UpdateTemplateInput{
			SubjectI18n:  originalSubject,
			BodyHTMLI18n: originalBody,
		})
		if restoreErr != nil {
			t.Fatalf("restore template: %v", restoreErr)
		}
	})

	updated, err := store.UpdateTemplateByCode(ctx, tpl.Code, UpdateTemplateInput{
		SubjectI18n: map[string]string{
			"en": "Test subject EN {{.OrderNumber}}",
			"lt": "Test subject LT {{.OrderNumber}}",
		},
		BodyHTMLI18n: map[string]string{
			"en": "<p>Test EN {{.OrderNumber}}</p>",
			"lt": "<p>Test LT {{.OrderNumber}}</p>",
		},
	})
	if err != nil {
		t.Fatalf("update template by code: %v", err)
	}
	if updated.SubjectI18n["en"] != "Test subject EN {{.OrderNumber}}" {
		t.Fatalf("unexpected updated EN subject: %q", updated.SubjectI18n["en"])
	}
	if updated.BodyHTMLI18n["lt"] != "<p>Test LT {{.OrderNumber}}</p>" {
		t.Fatalf("unexpected updated LT body: %q", updated.BodyHTMLI18n["lt"])
	}

	updatedEmpty, err := store.UpdateTemplateByCode(ctx, tpl.Code, UpdateTemplateInput{})
	if err != nil {
		t.Fatalf("update template with empty maps: %v", err)
	}
	if updatedEmpty.SubjectI18n == nil {
		t.Fatal("expected non-nil subject_i18n map")
	}
	if updatedEmpty.BodyHTMLI18n == nil {
		t.Fatal("expected non-nil body_html_i18n map")
	}
	if len(updatedEmpty.SubjectI18n) != 0 {
		t.Fatalf("expected empty subject_i18n map, got %d keys", len(updatedEmpty.SubjectI18n))
	}
	if len(updatedEmpty.BodyHTMLI18n) != 0 {
		t.Fatalf("expected empty body_html_i18n map, got %d keys", len(updatedEmpty.BodyHTMLI18n))
	}
}

func TestStore_MissingTemplateBehavior(t *testing.T) {
	store, db := newTestStore(t)
	defer db.Close()
	defer store.Close()

	ctx := context.Background()
	_, err := store.GetTemplateByCode(ctx, "missing-template-code")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing get, got %v", err)
	}

	_, err = store.UpdateTemplateByCode(ctx, "missing-template-code", UpdateTemplateInput{
		SubjectI18n:  map[string]string{"en": "x"},
		BodyHTMLI18n: map[string]string{"en": "x"},
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound for missing update, got %v", err)
	}
}

func newTestStore(t *testing.T) (*Store, *sql.DB) {
	t.Helper()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping email storage integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	assertTableExists(t, ctx, db, "email_settings")
	assertTableExists(t, ctx, db, "email_templates")

	store, err := NewStore(ctx, db)
	if err != nil {
		db.Close()
		t.Fatalf("new email store: %v", err)
	}
	return store, db
}

func assertTableExists(t *testing.T, ctx context.Context, db *sql.DB, tableName string) {
	t.Helper()

	var exists bool
	err := db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = $1
		)
	`, tableName).Scan(&exists)
	if err != nil {
		t.Fatalf("check table %s exists: %v", tableName, err)
	}
	if !exists {
		t.Fatalf("table %s does not exist; run migrations first", tableName)
	}
}

func cloneMap(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}
