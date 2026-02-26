package cms

import (
	"database/sql"
	"time"
)

const (
	PageStatusDraft     = "draft"
	PageStatusPublished = "published"

	EditorModeHTML   = "html"
	EditorModeVisual = "visual"

	NavItemTypePage     = "page"
	NavItemTypeURL      = "url"
	NavItemTypeCategory = "category"
)

type Page struct {
	ID              string       `json:"id"`
	Title           string       `json:"title"`
	TitleI18n       []byte       `json:"title_i18n"`
	Slug            string       `json:"slug"`
	Status          string       `json:"status"`
	ContentHTML     string       `json:"content_html"`
	ContentHTMLI18n []byte       `json:"content_html_i18n"`
	ContentJSON     []byte       `json:"content_json"`
	EditorMode      string       `json:"editor_mode"`
	MetaTitle       *string      `json:"meta_title"`
	MetaDescription *string      `json:"meta_description"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
	PublishedAt     sql.NullTime `json:"published_at"`
}

type NavigationItem struct {
	ID           string    `json:"id"`
	MenuID       string    `json:"menu_id"`
	Label        string    `json:"label"`
	LabelI18n    []byte    `json:"label_i18n"`
	Type         string    `json:"type"`
	PageID       *string   `json:"page_id"`
	CategoryID   *string   `json:"category_id"`
	URL          *string   `json:"url"`
	OpenInNewTab bool      `json:"open_in_new_tab"`
	SortOrder    int       `json:"sort_order"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type NavigationMenu struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type NavigationLocation struct {
	ID           string     `json:"id"`
	Code         string     `json:"code"`
	Name         string     `json:"name"`
	Description  *string    `json:"description"`
	MenuID       *string    `json:"menu_id"`
	MenuCode     *string    `json:"menu_code"`
	MenuName     *string    `json:"menu_name"`
	AssignmentAt *time.Time `json:"assignment_updated_at"`
}
