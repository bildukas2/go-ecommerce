package cms

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	platformdb "goecommerce/internal/platform/db"
)

func TestPageCRUD(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping CMS integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "pages")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("cms store init: %v", err)
	}
	defer store.Close()

	// 1. Create
	slug := fmt.Sprintf("/test-%d", time.Now().UnixNano())
	p := Page{
		Title:       "Test Page",
		Slug:        slug,
		Status:      PageStatusDraft,
		ContentHTML: "<p>Hello World</p>",
		EditorMode:  EditorModeHTML,
	}

	created, err := store.CreatePage(ctx, p)
	if err != nil {
		t.Fatalf("create page: %v", err)
	}

	if created.ID == "" {
		t.Fatal("expected non-empty ID")
	}
	if created.Title != p.Title {
		t.Errorf("expected title %s, got %s", p.Title, created.Title)
	}

	// 2. Get by ID
	gotByID, err := store.GetPageByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("get page by id: %v", err)
	}
	if gotByID.Slug != slug {
		t.Errorf("expected slug %s, got %s", slug, gotByID.Slug)
	}

	// 3. Get by Slug
	gotBySlug, err := store.GetPageBySlug(ctx, slug)
	if err != nil {
		t.Fatalf("get page by slug: %v", err)
	}
	if gotBySlug.ID != created.ID {
		t.Errorf("expected id %s, got %s", created.ID, gotBySlug.ID)
	}

	// 4. Update
	gotByID.Title = "Updated Title"
	gotByID.Status = PageStatusPublished
	now := time.Now()
	gotByID.PublishedAt = sql.NullTime{Time: now, Valid: true}

	updated, err := store.UpdatePage(ctx, gotByID)
	if err != nil {
		t.Fatalf("update page: %v", err)
	}
	if updated.Title != "Updated Title" {
		t.Errorf("expected updated title, got %s", updated.Title)
	}
	if updated.Status != PageStatusPublished {
		t.Errorf("expected published status, got %s", updated.Status)
	}

	// 5. List with filters
	pages, total, err := store.ListPages(ctx, ListPagesParams{Query: "Updated", Status: PageStatusPublished})
	if err != nil {
		t.Fatalf("list pages: %v", err)
	}
	if total < 1 {
		t.Errorf("expected total >= 1, got %d", total)
	}
	found := false
	for _, pg := range pages {
		if pg.ID == created.ID {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected to find updated page in list")
	}

	// 6. Delete
	err = store.DeletePage(ctx, created.ID)
	if err != nil {
		t.Fatalf("delete page: %v", err)
	}

	_, err = store.GetPageByID(ctx, created.ID)
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestNavigationCRUD(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping CMS integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "navigation_items")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("cms store init: %v", err)
	}
	defer store.Close()

	// 1. Create
	n := NavigationItem{
		Label:     "Home",
		Type:      NavItemTypeURL,
		URL:       stringPtr("/"),
		SortOrder: 10,
		IsActive:  true,
	}

	created, err := store.CreateNavigationItem(ctx, n)
	if err != nil {
		t.Fatalf("create nav item: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected non-empty ID")
	}

	// 2. Get
	got, err := store.GetNavigationItem(ctx, created.ID)
	if err != nil {
		t.Fatalf("get nav item: %v", err)
	}
	if got.Label != n.Label {
		t.Errorf("expected label %s, got %s", n.Label, got.Label)
	}

	// 3. Update
	got.Label = "New Label"
	updated, err := store.UpdateNavigationItem(ctx, got)
	if err != nil {
		t.Fatalf("update nav item: %v", err)
	}
	if updated.Label != "New Label" {
		t.Errorf("expected updated label, got %s", updated.Label)
	}

	// 4. List
	items, err := store.ListNavigationItems(ctx)
	if err != nil {
		t.Fatalf("list nav items: %v", err)
	}
	found := false
	for _, it := range items {
		if it.ID == created.ID {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected to find nav item in list")
	}

	// 5. Reorder
	n2 := NavigationItem{Label: "Contact", Type: NavItemTypeURL, URL: stringPtr("/contact"), SortOrder: 20}
	created2, _ := store.CreateNavigationItem(ctx, n2)

	err = store.UpdateNavigationOrder(ctx, []NavOrderUpdate{
		{ID: created.ID, SortOrder: 50},
		{ID: created2.ID, SortOrder: 40},
	})
	if err != nil {
		t.Fatalf("update nav order: %v", err)
	}

	items, _ = store.ListNavigationItems(ctx)
	// it should be sorted by sort_order ASC
	if items[0].ID != created2.ID {
		t.Errorf("expected item 2 to be first after reorder, got %s", items[0].ID)
	}

	// 6. Delete
	err = store.DeleteNavigationItem(ctx, created.ID)
	if err != nil {
		t.Fatalf("delete nav item: %v", err)
	}
	store.DeleteNavigationItem(ctx, created2.ID)
}

func assertTableExists(t *testing.T, ctx context.Context, db *sql.DB, tableName string) {
	var exists bool
	query := "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)"
	err := db.QueryRowContext(ctx, query, tableName).Scan(&exists)
	if err != nil {
		t.Fatalf("check table %s exists error: %v", tableName, err)
	}
	if !exists {
		t.Fatalf("table %s does not exist in database", tableName)
	}
}

func stringPtr(s string) *string {
	return &s
}
