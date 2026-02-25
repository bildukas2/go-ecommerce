package cms

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict")
)

const legacyDefaultMenuCode = "legacy_default"

type Store struct {
	db *sql.DB

	// Page statements
	stmtCreatePage    *sql.Stmt
	stmtGetPageByID   *sql.Stmt
	stmtGetPageBySlug *sql.Stmt
	stmtUpdatePage    *sql.Stmt
	stmtDeletePage    *sql.Stmt

	// Navigation menu statements
	stmtCreateNavMenu       *sql.Stmt
	stmtGetNavMenu          *sql.Stmt
	stmtUpdateNavMenu       *sql.Stmt
	stmtDeleteNavMenu       *sql.Stmt
	stmtListNavMenus        *sql.Stmt
	stmtIsNavMenuAssigned   *sql.Stmt
	stmtResolveLegacyMenuID *sql.Stmt

	// Navigation item statements
	stmtCreateNavItem        *sql.Stmt
	stmtGetNavItem           *sql.Stmt
	stmtUpdateNavItem        *sql.Stmt
	stmtDeleteNavItem        *sql.Stmt
	stmtListNavItems         *sql.Stmt
	stmtListNavItemsByMenu   *sql.Stmt
	stmtUpdateNavOrder       *sql.Stmt
	stmtUpdateNavOrderScoped *sql.Stmt

	// Navigation location statements
	stmtListNavLocations            *sql.Stmt
	stmtUpsertNavLocationAssignment *sql.Stmt
	stmtDeleteNavLocationAssignment *sql.Stmt
}

func NewStore(ctx context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}

	s := &Store{db: db}

	var err error

	// Pages
	s.stmtCreatePage, err = db.PrepareContext(ctx, `
		INSERT INTO pages (
			title, slug, status, content_html, content_json, editor_mode,
			meta_title, meta_description, published_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, title, slug, status, content_html, content_json, editor_mode,
		          meta_title, meta_description, created_at, updated_at, published_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare create page: %w", err)
	}

	s.stmtGetPageByID, err = db.PrepareContext(ctx, `
		SELECT id, title, slug, status, content_html, content_json, editor_mode,
		       meta_title, meta_description, created_at, updated_at, published_at
		FROM pages WHERE id = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare get page by id: %w", err)
	}

	s.stmtGetPageBySlug, err = db.PrepareContext(ctx, `
		SELECT id, title, slug, status, content_html, content_json, editor_mode,
		       meta_title, meta_description, created_at, updated_at, published_at
		FROM pages WHERE slug = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare get page by slug: %w", err)
	}

	s.stmtUpdatePage, err = db.PrepareContext(ctx, `
		UPDATE pages SET
			title = $2, slug = $3, status = $4, content_html = $5, content_json = $6,
			editor_mode = $7, meta_title = $8, meta_description = $9,
			published_at = $10, updated_at = NOW()
		WHERE id = $1
		RETURNING id, title, slug, status, content_html, content_json, editor_mode,
		          meta_title, meta_description, created_at, updated_at, published_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare update page: %w", err)
	}

	s.stmtDeletePage, err = db.PrepareContext(ctx, `
		DELETE FROM pages WHERE id = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare delete page: %w", err)
	}

	// Navigation menus
	s.stmtCreateNavMenu, err = db.PrepareContext(ctx, `
		INSERT INTO navigation_menus (code, name, description)
		VALUES ($1, $2, $3)
		RETURNING id, code, name, description, created_at, updated_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare create nav menu: %w", err)
	}

	s.stmtGetNavMenu, err = db.PrepareContext(ctx, `
		SELECT id, code, name, description, created_at, updated_at
		FROM navigation_menus
		WHERE id = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare get nav menu: %w", err)
	}

	s.stmtUpdateNavMenu, err = db.PrepareContext(ctx, `
		UPDATE navigation_menus
		SET code = $2, name = $3, description = $4, updated_at = NOW()
		WHERE id = $1
		RETURNING id, code, name, description, created_at, updated_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare update nav menu: %w", err)
	}

	s.stmtDeleteNavMenu, err = db.PrepareContext(ctx, `
		DELETE FROM navigation_menus
		WHERE id = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare delete nav menu: %w", err)
	}

	s.stmtListNavMenus, err = db.PrepareContext(ctx, `
		SELECT id, code, name, description, created_at, updated_at
		FROM navigation_menus
		ORDER BY name ASC, created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare list nav menus: %w", err)
	}

	s.stmtIsNavMenuAssigned, err = db.PrepareContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM navigation_location_assignments WHERE menu_id = $1
		)
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare is nav menu assigned: %w", err)
	}

	s.stmtResolveLegacyMenuID, err = db.PrepareContext(ctx, `
		SELECT id FROM navigation_menus WHERE code = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare resolve legacy menu id: %w", err)
	}

	// Navigation items
	s.stmtCreateNavItem, err = db.PrepareContext(ctx, `
		INSERT INTO navigation_items (
			menu_id, label, type, page_id, category_id, url, open_in_new_tab, sort_order, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, menu_id, label, type, page_id, category_id, url, open_in_new_tab, sort_order, is_active, created_at, updated_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare create nav item: %w", err)
	}

	s.stmtGetNavItem, err = db.PrepareContext(ctx, `
		SELECT id, menu_id, label, type, page_id, category_id, url, open_in_new_tab, sort_order, is_active, created_at, updated_at
		FROM navigation_items WHERE id = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare get nav item: %w", err)
	}

	s.stmtUpdateNavItem, err = db.PrepareContext(ctx, `
		UPDATE navigation_items SET
			menu_id = $2,
			label = $3,
			type = $4,
			page_id = $5,
			category_id = $6,
			url = $7,
			open_in_new_tab = $8,
			sort_order = $9,
			is_active = $10,
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, menu_id, label, type, page_id, category_id, url, open_in_new_tab, sort_order, is_active, created_at, updated_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare update nav item: %w", err)
	}

	s.stmtDeleteNavItem, err = db.PrepareContext(ctx, `
		DELETE FROM navigation_items WHERE id = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare delete nav item: %w", err)
	}

	s.stmtListNavItems, err = db.PrepareContext(ctx, `
		SELECT id, menu_id, label, type, page_id, category_id, url, open_in_new_tab, sort_order, is_active, created_at, updated_at
		FROM navigation_items
		ORDER BY sort_order ASC, created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare list nav items: %w", err)
	}

	s.stmtListNavItemsByMenu, err = db.PrepareContext(ctx, `
		SELECT id, menu_id, label, type, page_id, category_id, url, open_in_new_tab, sort_order, is_active, created_at, updated_at
		FROM navigation_items
		WHERE menu_id = $1
		ORDER BY sort_order ASC, created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare list nav items by menu: %w", err)
	}

	s.stmtUpdateNavOrder, err = db.PrepareContext(ctx, `
		UPDATE navigation_items SET sort_order = $2, updated_at = NOW() WHERE id = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare update nav order: %w", err)
	}

	s.stmtUpdateNavOrderScoped, err = db.PrepareContext(ctx, `
		UPDATE navigation_items
		SET sort_order = $2, updated_at = NOW()
		WHERE id = $1 AND menu_id = $3
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare update nav order scoped: %w", err)
	}

	// Navigation locations
	s.stmtListNavLocations, err = db.PrepareContext(ctx, `
		SELECT
			l.id,
			l.code,
			l.name,
			l.description,
			a.menu_id,
			m.code AS menu_code,
			m.name AS menu_name,
			a.updated_at
		FROM navigation_locations l
		LEFT JOIN navigation_location_assignments a ON a.location_code = l.code
		LEFT JOIN navigation_menus m ON m.id = a.menu_id
		ORDER BY l.code ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare list nav locations: %w", err)
	}

	s.stmtUpsertNavLocationAssignment, err = db.PrepareContext(ctx, `
		INSERT INTO navigation_location_assignments (location_code, menu_id, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (location_code)
		DO UPDATE SET menu_id = EXCLUDED.menu_id, updated_at = NOW()
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare upsert nav location assignment: %w", err)
	}

	s.stmtDeleteNavLocationAssignment, err = db.PrepareContext(ctx, `
		DELETE FROM navigation_location_assignments WHERE location_code = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare delete nav location assignment: %w", err)
	}

	return s, nil
}

func (s *Store) Close() error {
	stmts := []*sql.Stmt{
		s.stmtCreatePage,
		s.stmtGetPageByID,
		s.stmtGetPageBySlug,
		s.stmtUpdatePage,
		s.stmtDeletePage,
		s.stmtCreateNavMenu,
		s.stmtGetNavMenu,
		s.stmtUpdateNavMenu,
		s.stmtDeleteNavMenu,
		s.stmtListNavMenus,
		s.stmtIsNavMenuAssigned,
		s.stmtResolveLegacyMenuID,
		s.stmtCreateNavItem,
		s.stmtGetNavItem,
		s.stmtUpdateNavItem,
		s.stmtDeleteNavItem,
		s.stmtListNavItems,
		s.stmtListNavItemsByMenu,
		s.stmtUpdateNavOrder,
		s.stmtUpdateNavOrderScoped,
		s.stmtListNavLocations,
		s.stmtUpsertNavLocationAssignment,
		s.stmtDeleteNavLocationAssignment,
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

// Page operations

func (s *Store) CreatePage(ctx context.Context, p Page) (Page, error) {
	var out Page
	err := s.stmtCreatePage.QueryRowContext(ctx,
		p.Title, p.Slug, p.Status, p.ContentHTML, p.ContentJSON, p.EditorMode,
		p.MetaTitle, p.MetaDescription, p.PublishedAt,
	).Scan(
		&out.ID, &out.Title, &out.Slug, &out.Status, &out.ContentHTML, &out.ContentJSON, &out.EditorMode,
		&out.MetaTitle, &out.MetaDescription, &out.CreatedAt, &out.UpdatedAt, &out.PublishedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "23505") {
			return Page{}, ErrConflict
		}
		return Page{}, err
	}
	return out, nil
}

func (s *Store) GetPageByID(ctx context.Context, id string) (Page, error) {
	var out Page
	err := s.stmtGetPageByID.QueryRowContext(ctx, id).Scan(
		&out.ID, &out.Title, &out.Slug, &out.Status, &out.ContentHTML, &out.ContentJSON, &out.EditorMode,
		&out.MetaTitle, &out.MetaDescription, &out.CreatedAt, &out.UpdatedAt, &out.PublishedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Page{}, ErrNotFound
		}
		return Page{}, err
	}
	return out, nil
}

func (s *Store) GetPageBySlug(ctx context.Context, slug string) (Page, error) {
	var out Page
	err := s.stmtGetPageBySlug.QueryRowContext(ctx, slug).Scan(
		&out.ID, &out.Title, &out.Slug, &out.Status, &out.ContentHTML, &out.ContentJSON, &out.EditorMode,
		&out.MetaTitle, &out.MetaDescription, &out.CreatedAt, &out.UpdatedAt, &out.PublishedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Page{}, ErrNotFound
		}
		return Page{}, err
	}
	return out, nil
}

func (s *Store) UpdatePage(ctx context.Context, p Page) (Page, error) {
	var out Page
	err := s.stmtUpdatePage.QueryRowContext(ctx,
		p.ID, p.Title, p.Slug, p.Status, p.ContentHTML, p.ContentJSON, p.EditorMode,
		p.MetaTitle, p.MetaDescription, p.PublishedAt,
	).Scan(
		&out.ID, &out.Title, &out.Slug, &out.Status, &out.ContentHTML, &out.ContentJSON, &out.EditorMode,
		&out.MetaTitle, &out.MetaDescription, &out.CreatedAt, &out.UpdatedAt, &out.PublishedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Page{}, ErrNotFound
		}
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "23505") {
			return Page{}, ErrConflict
		}
		return Page{}, err
	}
	return out, nil
}

func (s *Store) DeletePage(ctx context.Context, id string) error {
	res, err := s.stmtDeletePage.ExecContext(ctx, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

type ListPagesParams struct {
	Query  string
	Status string
	Limit  int
	Offset int
}

func (s *Store) ListPages(ctx context.Context, params ListPagesParams) ([]Page, int, error) {
	var where []string
	var args []interface{}
	argID := 1

	if params.Query != "" {
		where = append(where, fmt.Sprintf("(title ILIKE $%d OR slug ILIKE $%d)", argID, argID))
		args = append(args, "%"+params.Query+"%")
		argID++
	}

	if params.Status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argID))
		args = append(args, params.Status)
		argID++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM pages %s", whereClause)
	var total int
	err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT id, title, slug, status, content_html, content_json, editor_mode,
		       meta_title, meta_description, created_at, updated_at, published_at
		FROM pages
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argID, argID+1)
	args = append(args, limit, offset)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []Page
	for rows.Next() {
		var p Page
		err := rows.Scan(
			&p.ID, &p.Title, &p.Slug, &p.Status, &p.ContentHTML, &p.ContentJSON, &p.EditorMode,
			&p.MetaTitle, &p.MetaDescription, &p.CreatedAt, &p.UpdatedAt, &p.PublishedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, p)
	}

	return out, total, nil
}

// Navigation menu operations

func (s *Store) CreateNavigationMenu(ctx context.Context, m NavigationMenu) (NavigationMenu, error) {
	var out NavigationMenu
	err := s.stmtCreateNavMenu.QueryRowContext(ctx, m.Code, m.Name, m.Description).Scan(
		&out.ID, &out.Code, &out.Name, &out.Description, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return NavigationMenu{}, ErrConflict
		}
		return NavigationMenu{}, err
	}
	return out, nil
}

func (s *Store) GetNavigationMenu(ctx context.Context, id string) (NavigationMenu, error) {
	var out NavigationMenu
	err := s.stmtGetNavMenu.QueryRowContext(ctx, id).Scan(
		&out.ID, &out.Code, &out.Name, &out.Description, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return NavigationMenu{}, ErrNotFound
		}
		return NavigationMenu{}, err
	}
	return out, nil
}

func (s *Store) UpdateNavigationMenu(ctx context.Context, m NavigationMenu) (NavigationMenu, error) {
	var out NavigationMenu
	err := s.stmtUpdateNavMenu.QueryRowContext(ctx, m.ID, m.Code, m.Name, m.Description).Scan(
		&out.ID, &out.Code, &out.Name, &out.Description, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return NavigationMenu{}, ErrNotFound
		}
		if isUniqueViolation(err) {
			return NavigationMenu{}, ErrConflict
		}
		return NavigationMenu{}, err
	}
	return out, nil
}

func (s *Store) DeleteNavigationMenu(ctx context.Context, id string) error {
	var assigned bool
	if err := s.stmtIsNavMenuAssigned.QueryRowContext(ctx, id).Scan(&assigned); err != nil {
		return err
	}
	if assigned {
		return ErrConflict
	}

	res, err := s.stmtDeleteNavMenu.ExecContext(ctx, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListNavigationMenus(ctx context.Context) ([]NavigationMenu, error) {
	rows, err := s.stmtListNavMenus.QueryContext(ctx)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]NavigationMenu, 0)
	for rows.Next() {
		var m NavigationMenu
		if err := rows.Scan(&m.ID, &m.Code, &m.Name, &m.Description, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, nil
}

// Navigation item operations

func (s *Store) CreateNavigationItem(ctx context.Context, n NavigationItem) (NavigationItem, error) {
	if err := validateNavigationItemTarget(n.Type, n.PageID, n.CategoryID, n.URL); err != nil {
		return NavigationItem{}, err
	}
	if strings.TrimSpace(n.MenuID) == "" {
		menuID, err := s.resolveLegacyDefaultMenuID(ctx)
		if err != nil {
			return NavigationItem{}, err
		}
		n.MenuID = menuID
	}

	var out NavigationItem
	err := s.stmtCreateNavItem.QueryRowContext(ctx,
		n.MenuID,
		n.Label,
		n.Type,
		n.PageID,
		n.CategoryID,
		n.URL,
		n.OpenInNewTab,
		n.SortOrder,
		n.IsActive,
	).Scan(
		&out.ID,
		&out.MenuID,
		&out.Label,
		&out.Type,
		&out.PageID,
		&out.CategoryID,
		&out.URL,
		&out.OpenInNewTab,
		&out.SortOrder,
		&out.IsActive,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return NavigationItem{}, err
	}
	return out, nil
}

func (s *Store) GetNavigationItem(ctx context.Context, id string) (NavigationItem, error) {
	var out NavigationItem
	err := s.stmtGetNavItem.QueryRowContext(ctx, id).Scan(
		&out.ID,
		&out.MenuID,
		&out.Label,
		&out.Type,
		&out.PageID,
		&out.CategoryID,
		&out.URL,
		&out.OpenInNewTab,
		&out.SortOrder,
		&out.IsActive,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return NavigationItem{}, ErrNotFound
		}
		return NavigationItem{}, err
	}
	return out, nil
}

func (s *Store) UpdateNavigationItem(ctx context.Context, n NavigationItem) (NavigationItem, error) {
	if strings.TrimSpace(n.MenuID) == "" {
		existing, err := s.GetNavigationItem(ctx, n.ID)
		if err != nil {
			return NavigationItem{}, err
		}
		n.MenuID = existing.MenuID
	}
	if err := validateNavigationItemTarget(n.Type, n.PageID, n.CategoryID, n.URL); err != nil {
		return NavigationItem{}, err
	}

	var out NavigationItem
	err := s.stmtUpdateNavItem.QueryRowContext(ctx,
		n.ID,
		n.MenuID,
		n.Label,
		n.Type,
		n.PageID,
		n.CategoryID,
		n.URL,
		n.OpenInNewTab,
		n.SortOrder,
		n.IsActive,
	).Scan(
		&out.ID,
		&out.MenuID,
		&out.Label,
		&out.Type,
		&out.PageID,
		&out.CategoryID,
		&out.URL,
		&out.OpenInNewTab,
		&out.SortOrder,
		&out.IsActive,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return NavigationItem{}, ErrNotFound
		}
		return NavigationItem{}, err
	}
	return out, nil
}

func (s *Store) DeleteNavigationItem(ctx context.Context, id string) error {
	res, err := s.stmtDeleteNavItem.ExecContext(ctx, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListNavigationItems(ctx context.Context) ([]NavigationItem, error) {
	rows, err := s.stmtListNavItems.QueryContext(ctx)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanNavigationItems(rows)
}

func (s *Store) ListNavigationItemsByMenu(ctx context.Context, menuID string) ([]NavigationItem, error) {
	rows, err := s.stmtListNavItemsByMenu.QueryContext(ctx, menuID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanNavigationItems(rows)
}

type NavOrderUpdate struct {
	ID        string
	SortOrder int
}

func (s *Store) UpdateNavigationOrder(ctx context.Context, updates []NavOrderUpdate) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt := tx.StmtContext(ctx, s.stmtUpdateNavOrder)
	for _, u := range updates {
		if _, err := stmt.ExecContext(ctx, u.ID, u.SortOrder); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) UpdateNavigationMenuOrder(ctx context.Context, menuID string, itemIDs []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt := tx.StmtContext(ctx, s.stmtUpdateNavOrderScoped)
	for idx, itemID := range itemIDs {
		if _, err := stmt.ExecContext(ctx, itemID, idx, menuID); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// Navigation location operations

func (s *Store) ListNavigationLocations(ctx context.Context) ([]NavigationLocation, error) {
	rows, err := s.stmtListNavLocations.QueryContext(ctx)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]NavigationLocation, 0)
	for rows.Next() {
		var loc NavigationLocation
		var menuID sql.NullString
		var menuCode sql.NullString
		var menuName sql.NullString
		var assignmentAt sql.NullTime
		if err := rows.Scan(
			&loc.ID,
			&loc.Code,
			&loc.Name,
			&loc.Description,
			&menuID,
			&menuCode,
			&menuName,
			&assignmentAt,
		); err != nil {
			return nil, err
		}
		if menuID.Valid {
			loc.MenuID = &menuID.String
		}
		if menuCode.Valid {
			loc.MenuCode = &menuCode.String
		}
		if menuName.Valid {
			loc.MenuName = &menuName.String
		}
		if assignmentAt.Valid {
			loc.AssignmentAt = &assignmentAt.Time
		}
		out = append(out, loc)
	}

	return out, nil
}

func (s *Store) AssignNavigationLocation(ctx context.Context, locationCode, menuID string) error {
	locationCode = strings.TrimSpace(locationCode)
	if locationCode == "" {
		return ErrNotFound
	}

	var locationExists bool
	if err := s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM navigation_locations WHERE code = $1)", locationCode).Scan(&locationExists); err != nil {
		return err
	}
	if !locationExists {
		return ErrNotFound
	}

	if strings.TrimSpace(menuID) == "" {
		res, err := s.stmtDeleteNavLocationAssignment.ExecContext(ctx, locationCode)
		if err != nil {
			return err
		}
		_, _ = res.RowsAffected()
		return nil
	}

	var menuExists bool
	if err := s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM navigation_menus WHERE id = $1)", menuID).Scan(&menuExists); err != nil {
		return err
	}
	if !menuExists {
		return ErrNotFound
	}

	if _, err := s.stmtUpsertNavLocationAssignment.ExecContext(ctx, locationCode, menuID); err != nil {
		return err
	}
	return nil
}

func (s *Store) IsPageUsedInNavigation(ctx context.Context, pageID string) (bool, error) {
	var exists bool
	err := s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM navigation_items WHERE page_id = $1)", pageID).Scan(&exists)
	return exists, err
}

func (s *Store) IsCategoryUsedInNavigation(ctx context.Context, categoryID string) (bool, error) {
	var exists bool
	err := s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM navigation_items WHERE category_id = $1)", categoryID).Scan(&exists)
	return exists, err
}

func (s *Store) GetPublishedPageSlugByID(ctx context.Context, id string) (string, error) {
	var slug string
	err := s.db.QueryRowContext(ctx, "SELECT slug FROM pages WHERE id = $1 AND status = $2", id, PageStatusPublished).Scan(&slug)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return slug, nil
}

func (s *Store) GetCategorySlugByID(ctx context.Context, id string) (string, error) {
	var slug string
	err := s.db.QueryRowContext(ctx, "SELECT slug FROM categories WHERE id = $1", id).Scan(&slug)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return slug, nil
}

func (s *Store) resolveLegacyDefaultMenuID(ctx context.Context) (string, error) {
	var id string
	err := s.stmtResolveLegacyMenuID.QueryRowContext(ctx, legacyDefaultMenuCode).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return id, nil
}

func scanNavigationItems(rows *sql.Rows) ([]NavigationItem, error) {
	out := make([]NavigationItem, 0)
	for rows.Next() {
		var n NavigationItem
		if err := rows.Scan(
			&n.ID,
			&n.MenuID,
			&n.Label,
			&n.Type,
			&n.PageID,
			&n.CategoryID,
			&n.URL,
			&n.OpenInNewTab,
			&n.SortOrder,
			&n.IsActive,
			&n.CreatedAt,
			&n.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

func validateNavigationItemTarget(navType string, pageID, categoryID, url *string) error {
	hasPage := pageID != nil && strings.TrimSpace(*pageID) != ""
	hasCategory := categoryID != nil && strings.TrimSpace(*categoryID) != ""
	hasURL := url != nil && strings.TrimSpace(*url) != ""

	switch navType {
	case NavItemTypePage:
		if !hasPage || hasCategory || hasURL {
			return fmt.Errorf("invalid target for type %s", NavItemTypePage)
		}
	case NavItemTypeURL:
		if hasPage || hasCategory || !hasURL {
			return fmt.Errorf("invalid target for type %s", NavItemTypeURL)
		}
	case NavItemTypeCategory:
		if hasPage || !hasCategory || hasURL {
			return fmt.Errorf("invalid target for type %s", NavItemTypeCategory)
		}
	default:
		return fmt.Errorf("invalid navigation type")
	}

	return nil
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "unique constraint") || strings.Contains(msg, "23505")
}
