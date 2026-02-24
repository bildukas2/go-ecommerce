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

type Store struct {
	db *sql.DB

	// Page statements
	stmtCreatePage    *sql.Stmt
	stmtGetPageByID   *sql.Stmt
	stmtGetPageBySlug *sql.Stmt
	stmtUpdatePage    *sql.Stmt
	stmtDeletePage    *sql.Stmt

	// Navigation statements
	stmtCreateNavItem    *sql.Stmt
	stmtGetNavItem       *sql.Stmt
	stmtUpdateNavItem    *sql.Stmt
	stmtDeleteNavItem    *sql.Stmt
	stmtListNavItems     *sql.Stmt
	stmtUpdateNavOrder   *sql.Stmt
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

	// Navigation
	s.stmtCreateNavItem, err = db.PrepareContext(ctx, `
		INSERT INTO navigation_items (
			label, type, page_id, url, open_in_new_tab, sort_order, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, label, type, page_id, url, open_in_new_tab, sort_order, is_active, created_at, updated_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare create nav item: %w", err)
	}

	s.stmtGetNavItem, err = db.PrepareContext(ctx, `
		SELECT id, label, type, page_id, url, open_in_new_tab, sort_order, is_active, created_at, updated_at
		FROM navigation_items WHERE id = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare get nav item: %w", err)
	}

	s.stmtUpdateNavItem, err = db.PrepareContext(ctx, `
		UPDATE navigation_items SET 
			label = $2, type = $3, page_id = $4, url = $5, 
			open_in_new_tab = $6, sort_order = $7, is_active = $8, updated_at = NOW()
		WHERE id = $1
		RETURNING id, label, type, page_id, url, open_in_new_tab, sort_order, is_active, created_at, updated_at
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
		SELECT id, label, type, page_id, url, open_in_new_tab, sort_order, is_active, created_at, updated_at
		FROM navigation_items
		ORDER BY sort_order ASC, created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare list nav items: %w", err)
	}

	s.stmtUpdateNavOrder, err = db.PrepareContext(ctx, `
		UPDATE navigation_items SET sort_order = $2, updated_at = NOW() WHERE id = $1
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare update nav order: %w", err)
	}

	return s, nil
}

func (s *Store) Close() error {
	stmts := []*sql.Stmt{
		s.stmtCreatePage, s.stmtGetPageByID, s.stmtGetPageBySlug, s.stmtUpdatePage, s.stmtDeletePage,
		s.stmtCreateNavItem, s.stmtGetNavItem, s.stmtUpdateNavItem, s.stmtDeleteNavItem, s.stmtListNavItems, s.stmtUpdateNavOrder,
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

// Navigation operations

func (s *Store) CreateNavigationItem(ctx context.Context, n NavigationItem) (NavigationItem, error) {
	var out NavigationItem
	err := s.stmtCreateNavItem.QueryRowContext(ctx,
		n.Label, n.Type, n.PageID, n.URL, n.OpenInNewTab, n.SortOrder, n.IsActive,
	).Scan(
		&out.ID, &out.Label, &out.Type, &out.PageID, &out.URL, &out.OpenInNewTab, &out.SortOrder, &out.IsActive, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return NavigationItem{}, err
	}
	return out, nil
}

func (s *Store) GetNavigationItem(ctx context.Context, id string) (NavigationItem, error) {
	var out NavigationItem
	err := s.stmtGetNavItem.QueryRowContext(ctx, id).Scan(
		&out.ID, &out.Label, &out.Type, &out.PageID, &out.URL, &out.OpenInNewTab, &out.SortOrder, &out.IsActive, &out.CreatedAt, &out.UpdatedAt,
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
	var out NavigationItem
	err := s.stmtUpdateNavItem.QueryRowContext(ctx,
		n.ID, n.Label, n.Type, n.PageID, n.URL, n.OpenInNewTab, n.SortOrder, n.IsActive,
	).Scan(
		&out.ID, &out.Label, &out.Type, &out.PageID, &out.URL, &out.OpenInNewTab, &out.SortOrder, &out.IsActive, &out.CreatedAt, &out.UpdatedAt,
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

	var out []NavigationItem
	for rows.Next() {
		var n NavigationItem
		err := rows.Scan(
			&n.ID, &n.Label, &n.Type, &n.PageID, &n.URL, &n.OpenInNewTab, &n.SortOrder, &n.IsActive, &n.CreatedAt, &n.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
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
		_, err := stmt.ExecContext(ctx, u.ID, u.SortOrder)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) IsPageUsedInNavigation(ctx context.Context, pageID string) (bool, error) {
	var exists bool
	err := s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM navigation_items WHERE page_id = $1)", pageID).Scan(&exists)
	return exists, err
}
