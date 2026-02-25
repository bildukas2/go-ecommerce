package cms

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
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

	assertTableExists(t, ctx, db, "navigation_menus")
	assertTableExists(t, ctx, db, "navigation_items")
	assertTableExists(t, ctx, db, "navigation_locations")
	assertTableExists(t, ctx, db, "navigation_location_assignments")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("cms store init: %v", err)
	}
	defer store.Close()

	menuCode := fmt.Sprintf("test-menu-%d", time.Now().UnixNano())
	secondaryMenuCode := fmt.Sprintf("test-menu-alt-%d", time.Now().UnixNano())
	createdMenu, err := store.CreateNavigationMenu(ctx, NavigationMenu{
		Code: menuCode,
		Name: "Test Menu",
	})
	if err != nil {
		t.Fatalf("create navigation menu: %v", err)
	}
	createdMenu2, err := store.CreateNavigationMenu(ctx, NavigationMenu{
		Code: secondaryMenuCode,
		Name: "Secondary Menu",
	})
	if err != nil {
		t.Fatalf("create secondary menu: %v", err)
	}

	categoryID := createTestCategory(t, ctx, db)
	page := createTestPage(t, ctx, store)

	// URL item
	urlItem, err := store.CreateNavigationItem(ctx, NavigationItem{
		MenuID:    createdMenu.ID,
		Label:     "Home",
		Type:      NavItemTypeURL,
		URL:       stringPtr("/"),
		SortOrder: 20,
		IsActive:  true,
	})
	if err != nil {
		t.Fatalf("create url nav item: %v", err)
	}

	// Page item
	pageItem, err := store.CreateNavigationItem(ctx, NavigationItem{
		MenuID:    createdMenu.ID,
		Label:     "About",
		Type:      NavItemTypePage,
		PageID:    &page.ID,
		SortOrder: 30,
		IsActive:  true,
	})
	if err != nil {
		t.Fatalf("create page nav item: %v", err)
	}

	// Category item
	categoryItem, err := store.CreateNavigationItem(ctx, NavigationItem{
		MenuID:     createdMenu.ID,
		Label:      "Category",
		Type:       NavItemTypeCategory,
		CategoryID: &categoryID,
		SortOrder:  40,
		IsActive:   true,
	})
	if err != nil {
		t.Fatalf("create category nav item: %v", err)
	}

	// Legacy fallback path: menu omitted should resolve to default legacy menu.
	legacyItem, err := store.CreateNavigationItem(ctx, NavigationItem{
		Label:     "Legacy",
		Type:      NavItemTypeURL,
		URL:       stringPtr("/legacy"),
		SortOrder: 10,
		IsActive:  true,
	})
	if err != nil {
		t.Fatalf("create legacy nav item: %v", err)
	}
	if legacyItem.MenuID == "" {
		t.Fatal("expected legacy item menu_id to be resolved")
	}

	// target validation behavior
	_, err = store.CreateNavigationItem(ctx, NavigationItem{
		MenuID:    createdMenu.ID,
		Label:     "Invalid page",
		Type:      NavItemTypePage,
		SortOrder: 50,
		IsActive:  true,
	})
	if err == nil || !strings.Contains(err.Error(), "invalid target") {
		t.Fatalf("expected invalid target error, got: %v", err)
	}

	// list by menu
	menuItems, err := store.ListNavigationItemsByMenu(ctx, createdMenu.ID)
	if err != nil {
		t.Fatalf("list nav items by menu: %v", err)
	}
	if len(menuItems) < 3 {
		t.Fatalf("expected >= 3 menu items, got %d", len(menuItems))
	}

	// update item
	pageItem.Label = "About Us"
	updatedItem, err := store.UpdateNavigationItem(ctx, pageItem)
	if err != nil {
		t.Fatalf("update page nav item: %v", err)
	}
	if updatedItem.Label != "About Us" {
		t.Fatalf("expected updated label, got %s", updatedItem.Label)
	}

	// reorder menu with explicit menu-scoped method
	err = store.UpdateNavigationMenuOrder(ctx, createdMenu.ID, []string{categoryItem.ID, pageItem.ID, urlItem.ID})
	if err != nil {
		t.Fatalf("update nav menu order: %v", err)
	}
	menuItems, err = store.ListNavigationItemsByMenu(ctx, createdMenu.ID)
	if err != nil {
		t.Fatalf("list nav items by menu after reorder: %v", err)
	}
	if len(menuItems) < 3 || menuItems[0].ID != categoryItem.ID {
		t.Fatalf("unexpected order after reorder, first=%v", firstNavID(menuItems))
	}

	// location assignment
	err = store.AssignNavigationLocation(ctx, "footer_info", createdMenu.ID)
	if err != nil {
		t.Fatalf("assign location: %v", err)
	}
	locations, err := store.ListNavigationLocations(ctx)
	if err != nil {
		t.Fatalf("list locations: %v", err)
	}
	if !locationAssignedToMenu(locations, "footer_info", createdMenu.ID) {
		t.Fatal("expected footer_info to be assigned to created menu")
	}

	// delete menu should fail while assigned
	err = store.DeleteNavigationMenu(ctx, createdMenu.ID)
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("expected ErrConflict when deleting assigned menu, got %v", err)
	}

	// unassign and delete
	err = store.AssignNavigationLocation(ctx, "footer_info", "")
	if err != nil {
		t.Fatalf("clear location assignment: %v", err)
	}
	err = store.DeleteNavigationMenu(ctx, createdMenu2.ID)
	if err != nil {
		t.Fatalf("delete secondary menu: %v", err)
	}
	err = store.DeleteNavigationMenu(ctx, createdMenu.ID)
	if err != nil {
		t.Fatalf("delete menu after unassign: %v", err)
	}

	_ = store.DeleteNavigationItem(ctx, legacyItem.ID)
	_ = store.DeleteNavigationItem(ctx, categoryItem.ID)
	_ = store.DeleteNavigationItem(ctx, pageItem.ID)
	_ = store.DeleteNavigationItem(ctx, urlItem.ID)
	_ = store.DeletePage(ctx, page.ID)
	_, _ = db.ExecContext(ctx, "DELETE FROM categories WHERE id = $1", categoryID)
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

func createTestCategory(t *testing.T, ctx context.Context, db *sql.DB) string {
	t.Helper()
	slug := fmt.Sprintf("test-category-%d", time.Now().UnixNano())
	var id string
	err := db.QueryRowContext(ctx, `
		INSERT INTO categories (slug, name)
		VALUES ($1, $2)
		RETURNING id
	`, slug, "Test Category").Scan(&id)
	if err != nil {
		t.Fatalf("create category: %v", err)
	}
	return id
}

func createTestPage(t *testing.T, ctx context.Context, store *Store) Page {
	t.Helper()
	slug := fmt.Sprintf("/page-%d", time.Now().UnixNano())
	page, err := store.CreatePage(ctx, Page{
		Title:       "Nav Target Page",
		Slug:        slug,
		Status:      PageStatusPublished,
		ContentHTML: "<p>Nav target</p>",
		EditorMode:  EditorModeHTML,
	})
	if err != nil {
		t.Fatalf("create page target: %v", err)
	}
	return page
}

func locationAssignedToMenu(locations []NavigationLocation, code, menuID string) bool {
	for _, location := range locations {
		if location.Code == code && location.MenuID != nil && *location.MenuID == menuID {
			return true
		}
	}
	return false
}

func firstNavID(items []NavigationItem) string {
	if len(items) == 0 {
		return ""
	}
	return items[0].ID
}
