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

	NavItemTypePage = "page"
	NavItemTypeURL  = "url"
)

type Page struct {
	ID              string         `json:"id"`
	Title           string         `json:"title"`
	Slug            string         `json:"slug"`
	Status          string         `json:"status"`
	ContentHTML     string         `json:"content_html"`
	ContentJSON     []byte         `json:"content_json"`
	EditorMode      string         `json:"editor_mode"`
	MetaTitle       *string        `json:"meta_title"`
	MetaDescription *string        `json:"meta_description"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	PublishedAt     sql.NullTime   `json:"published_at"`
}

type NavigationItem struct {
	ID            string       `json:"id"`
	Label         string       `json:"label"`
	Type          string       `json:"type"`
	PageID        *string      `json:"page_id"`
	URL           *string      `json:"url"`
	OpenInNewTab bool         `json:"open_in_new_tab"`
	SortOrder     int          `json:"sort_order"`
	IsActive      bool         `json:"is_active"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_against"`
}
