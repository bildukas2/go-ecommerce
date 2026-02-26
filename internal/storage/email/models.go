package email

import "time"

type Settings struct {
	ID           int16     `json:"id"`
	Driver       string    `json:"driver"`
	SMTPHost     string    `json:"smtp_host"`
	SMTPPort     int       `json:"smtp_port"`
	SMTPUsername string    `json:"smtp_username"`
	SMTPPassword string    `json:"smtp_password"`
	FromName     string    `json:"from_name"`
	FromEmail    string    `json:"from_email"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type UpdateSettingsInput struct {
	Driver       string
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	FromName     string
	FromEmail    string
}

type Template struct {
	ID           string            `json:"id"`
	Code         string            `json:"code"`
	Name         string            `json:"name"`
	SubjectI18n  map[string]string `json:"subject_i18n"`
	BodyHTMLI18n map[string]string `json:"body_html_i18n"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

type UpdateTemplateInput struct {
	SubjectI18n  map[string]string
	BodyHTMLI18n map[string]string
}
