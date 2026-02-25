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
	Label        string  `json:"label"`
	Type         string  `json:"type"`
	PageID       *string `json:"page_id,omitempty"`
	CategoryID   *string `json:"category_id,omitempty"`
	URL          *string `json:"url,omitempty"`
	OpenInNewTab bool    `json:"open_in_new_tab"`
	SortOrder    int     `json:"sort_order"`
	IsActive     bool    `json:"is_active"`
}

type UpdateNavigationItemRequest struct {
	MenuID       *string `json:"menu_id,omitempty"`
	Label        string  `json:"label"`
	Type         string  `json:"type"`
	PageID       *string `json:"page_id,omitempty"`
	CategoryID   *string `json:"category_id,omitempty"`
	URL          *string `json:"url,omitempty"`
	OpenInNewTab bool    `json:"open_in_new_tab"`
	SortOrder    int     `json:"sort_order"`
	IsActive     bool    `json:"is_active"`
}

type NavigationItemResponse struct {
	ID           string    `json:"id"`
	MenuID       string    `json:"menu_id"`
	Label        string    `json:"label"`
	Type         string    `json:"type"`
	PageID       *string   `json:"page_id,omitempty"`
	CategoryID   *string   `json:"category_id,omitempty"`
	URL          *string   `json:"url,omitempty"`
	OpenInNewTab bool      `json:"open_in_new_tab"`
	SortOrder    int       `json:"sort_order"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ReorderNavigationRequest struct {
	ItemIDs []string `json:"item_ids"`
}

type CreateNavigationMenuRequest struct {
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

type UpdateNavigationMenuRequest struct {
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

type NavigationMenuResponse struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type AssignNavigationLocationRequest struct {
	MenuID      *string `json:"menu_id,omitempty"`
	MenuIDCamel *string `json:"menuId,omitempty"`
}

type NavigationLocationResponse struct {
	ID                  string     `json:"id"`
	Code                string     `json:"code"`
	Name                string     `json:"name"`
	Description         *string    `json:"description,omitempty"`
	MenuID              *string    `json:"menu_id,omitempty"`
	MenuCode            *string    `json:"menu_code,omitempty"`
	MenuName            *string    `json:"menu_name,omitempty"`
	AssignmentUpdatedAt *time.Time `json:"assignment_updated_at,omitempty"`
}

type NavigationResolvedItemResponse struct {
	Label        string `json:"label"`
	Href         string `json:"href"`
	Type         string `json:"type"`
	OpenInNewTab bool   `json:"open_in_new_tab"`
}

type NavigationResolvedMenuResponse struct {
	ID    string                           `json:"id"`
	Code  string                           `json:"code"`
	Name  string                           `json:"name"`
	Items []NavigationResolvedItemResponse `json:"items"`
}

type NavigationResolvedLocationResponse struct {
	Code string                          `json:"code"`
	Name string                          `json:"name"`
	Menu *NavigationResolvedMenuResponse `json:"menu,omitempty"`
}
