package cms

import (
	"encoding/json"
	"time"
)

type CreatePageRequest struct {
	Title           string          `json:"title"`
	Slug            string          `json:"slug"`
	Status          string          `json:"status"`
	ContentHTML     string          `json:"content_html"`
	ContentJSON     json.RawMessage `json:"content_json,omitempty"`
	EditorMode      string          `json:"editor_mode"`
	MetaTitle       *string         `json:"meta_title,omitempty"`
	MetaDescription *string         `json:"meta_description,omitempty"`
}

type UpdatePageRequest struct {
	Title           string          `json:"title"`
	Slug            string          `json:"slug"`
	Status          string          `json:"status"`
	ContentHTML     string          `json:"content_html"`
	ContentJSON     json.RawMessage `json:"content_json,omitempty"`
	EditorMode      string          `json:"editor_mode"`
	MetaTitle       *string         `json:"meta_title,omitempty"`
	MetaDescription *string         `json:"meta_description,omitempty"`
}

type PageResponse struct {
	ID              string          `json:"id"`
	Title           string          `json:"title"`
	Slug            string          `json:"slug"`
	Status          string          `json:"status"`
	ContentHTML     string          `json:"content_html"`
	ContentJSON     json.RawMessage `json:"content_json,omitempty"`
	EditorMode      string          `json:"editor_mode"`
	MetaTitle       *string         `json:"meta_title,omitempty"`
	MetaDescription *string         `json:"meta_description,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	PublishedAt     *time.Time      `json:"published_at,omitempty"`
}

type ListPagesResponse struct {
	Pages []PageResponse `json:"pages"`
	Total int            `json:"total"`
}

type CreateNavigationItemRequest struct {
	Label         string  `json:"label"`
	Type          string  `json:"type"`
	PageID        *string `json:"page_id,omitempty"`
	URL           *string `json:"url,omitempty"`
	OpenInNewTab bool    `json:"open_in_new_tab"`
	SortOrder     int     `json:"sort_order"`
	IsActive      bool    `json:"is_active"`
}

type UpdateNavigationItemRequest struct {
	Label         string  `json:"label"`
	Type          string  `json:"type"`
	PageID        *string `json:"page_id,omitempty"`
	URL           *string `json:"url,omitempty"`
	OpenInNewTab bool    `json:"open_in_new_tab"`
	SortOrder     int     `json:"sort_order"`
	IsActive      bool    `json:"is_active"`
}

type NavigationItemResponse struct {
	ID            string  `json:"id"`
	Label         string  `json:"label"`
	Type          string  `json:"type"`
	PageID        *string `json:"page_id,omitempty"`
	URL           *string `json:"url,omitempty"`
	OpenInNewTab bool    `json:"open_in_new_tab"`
	SortOrder     int     `json:"sort_order"`
	IsActive      bool    `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ReorderNavigationRequest struct {
	Items []struct {
		ID        string `json:"id"`
		SortOrder int    `json:"sort_order"`
	} `json:"items"`
}
