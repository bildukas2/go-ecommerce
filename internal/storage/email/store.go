package email

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	db *sql.DB

	stmtGetSettings        *sql.Stmt
	stmtUpdateSettings     *sql.Stmt
	stmtListTemplates      *sql.Stmt
	stmtGetTemplateByCode  *sql.Stmt
	stmtUpdateTemplateCode *sql.Stmt
}

func NewStore(ctx context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}

	s := &Store{db: db}
	var err error

	s.stmtGetSettings, err = db.PrepareContext(ctx, `
		SELECT id, driver, smtp_host, smtp_port, smtp_username, smtp_password, from_name, from_email, owner_emails, updated_at
		FROM email_settings
		WHERE id = 1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare get settings: %w", err)
	}

	s.stmtUpdateSettings, err = db.PrepareContext(ctx, `
		UPDATE email_settings
		SET driver = $1,
		    smtp_host = $2,
		    smtp_port = $3,
		    smtp_username = $4,
		    smtp_password = $5,
		    from_name = $6,
		    from_email = $7,
		    owner_emails = $8,
		    updated_at = now()
		WHERE id = 1
		RETURNING id, driver, smtp_host, smtp_port, smtp_username, smtp_password, from_name, from_email, owner_emails, updated_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare update settings: %w", err)
	}

	s.stmtListTemplates, err = db.PrepareContext(ctx, `
		SELECT id, code, name, subject_i18n, body_html_i18n, created_at, updated_at
		FROM email_templates
		ORDER BY name ASC, code ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare list templates: %w", err)
	}

	s.stmtGetTemplateByCode, err = db.PrepareContext(ctx, `
		SELECT id, code, name, subject_i18n, body_html_i18n, created_at, updated_at
		FROM email_templates
		WHERE code = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare get template by code: %w", err)
	}

	s.stmtUpdateTemplateCode, err = db.PrepareContext(ctx, `
		UPDATE email_templates
		SET subject_i18n = $2,
		    body_html_i18n = $3,
		    updated_at = now()
		WHERE code = $1
		RETURNING id, code, name, subject_i18n, body_html_i18n, created_at, updated_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare update template by code: %w", err)
	}

	return s, nil
}

func (s *Store) Close() error {
	stmts := []*sql.Stmt{
		s.stmtGetSettings,
		s.stmtUpdateSettings,
		s.stmtListTemplates,
		s.stmtGetTemplateByCode,
		s.stmtUpdateTemplateCode,
	}
	var firstErr error
	for _, stmt := range stmts {
		if stmt != nil {
			if err := stmt.Close(); err != nil && firstErr == nil {
				firstErr = err
			}
		}
	}
	return firstErr
}

func (s *Store) GetSettings(ctx context.Context) (Settings, error) {
	var out Settings
	err := s.stmtGetSettings.QueryRowContext(ctx).Scan(
		&out.ID,
		&out.Driver,
		&out.SMTPHost,
		&out.SMTPPort,
		&out.SMTPUsername,
		&out.SMTPPassword,
		&out.FromName,
		&out.FromEmail,
		&out.OwnerEmails,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Settings{}, ErrNotFound
		}
		return Settings{}, err
	}
	return out, nil
}

func (s *Store) UpdateSettings(ctx context.Context, in UpdateSettingsInput) (Settings, error) {
	var out Settings
	err := s.stmtUpdateSettings.QueryRowContext(ctx,
		strings.TrimSpace(in.Driver),
		strings.TrimSpace(in.SMTPHost),
		in.SMTPPort,
		strings.TrimSpace(in.SMTPUsername),
		in.SMTPPassword,
		strings.TrimSpace(in.FromName),
		strings.TrimSpace(in.FromEmail),
		strings.TrimSpace(in.OwnerEmails),
	).Scan(
		&out.ID,
		&out.Driver,
		&out.SMTPHost,
		&out.SMTPPort,
		&out.SMTPUsername,
		&out.SMTPPassword,
		&out.FromName,
		&out.FromEmail,
		&out.OwnerEmails,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Settings{}, ErrNotFound
		}
		return Settings{}, err
	}
	return out, nil
}

func (s *Store) ListTemplates(ctx context.Context) ([]Template, error) {
	rows, err := s.stmtListTemplates.QueryContext(ctx)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Template, 0)
	for rows.Next() {
		tpl, err := scanTemplate(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, tpl)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) GetTemplateByCode(ctx context.Context, code string) (Template, error) {
	code = strings.TrimSpace(code)
	var subjectRaw []byte
	var bodyRaw []byte
	var out Template
	err := s.stmtGetTemplateByCode.QueryRowContext(ctx, code).Scan(
		&out.ID,
		&out.Code,
		&out.Name,
		&subjectRaw,
		&bodyRaw,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Template{}, ErrNotFound
		}
		return Template{}, err
	}
	out.SubjectI18n, err = decodeI18nMap(subjectRaw)
	if err != nil {
		return Template{}, fmt.Errorf("decode subject_i18n: %w", err)
	}
	out.BodyHTMLI18n, err = decodeI18nMap(bodyRaw)
	if err != nil {
		return Template{}, fmt.Errorf("decode body_html_i18n: %w", err)
	}
	return out, nil
}

func (s *Store) UpdateTemplateByCode(ctx context.Context, code string, in UpdateTemplateInput) (Template, error) {
	code = strings.TrimSpace(code)
	subjectRaw, err := encodeI18nMap(in.SubjectI18n)
	if err != nil {
		return Template{}, fmt.Errorf("encode subject_i18n: %w", err)
	}
	bodyRaw, err := encodeI18nMap(in.BodyHTMLI18n)
	if err != nil {
		return Template{}, fmt.Errorf("encode body_html_i18n: %w", err)
	}

	var out Template
	var outSubjectRaw []byte
	var outBodyRaw []byte
	err = s.stmtUpdateTemplateCode.QueryRowContext(ctx, code, subjectRaw, bodyRaw).Scan(
		&out.ID,
		&out.Code,
		&out.Name,
		&outSubjectRaw,
		&outBodyRaw,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Template{}, ErrNotFound
		}
		return Template{}, err
	}
	out.SubjectI18n, err = decodeI18nMap(outSubjectRaw)
	if err != nil {
		return Template{}, fmt.Errorf("decode subject_i18n: %w", err)
	}
	out.BodyHTMLI18n, err = decodeI18nMap(outBodyRaw)
	if err != nil {
		return Template{}, fmt.Errorf("decode body_html_i18n: %w", err)
	}
	return out, nil
}

func scanTemplate(rows *sql.Rows) (Template, error) {
	var out Template
	var subjectRaw []byte
	var bodyRaw []byte
	err := rows.Scan(
		&out.ID,
		&out.Code,
		&out.Name,
		&subjectRaw,
		&bodyRaw,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return Template{}, err
	}
	out.SubjectI18n, err = decodeI18nMap(subjectRaw)
	if err != nil {
		return Template{}, fmt.Errorf("decode subject_i18n: %w", err)
	}
	out.BodyHTMLI18n, err = decodeI18nMap(bodyRaw)
	if err != nil {
		return Template{}, fmt.Errorf("decode body_html_i18n: %w", err)
	}
	return out, nil
}

func encodeI18nMap(v map[string]string) ([]byte, error) {
	if len(v) == 0 {
		return []byte(`{}`), nil
	}
	return json.Marshal(v)
}

func decodeI18nMap(raw []byte) (map[string]string, error) {
	if len(raw) == 0 {
		return map[string]string{}, nil
	}

	out := make(map[string]string)
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	if out == nil {
		return map[string]string{}, nil
	}
	return out, nil
}
