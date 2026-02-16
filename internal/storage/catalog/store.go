package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"
)

// Product represents a product row from the catalog.
type Product struct {
	ID          string    `json:"id"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Category represents a category row.
type Category struct {
	ID       string         `json:"id"`
	Slug     string         `json:"slug"`
	Name     string         `json:"name"`
	ParentID sql.NullString `json:"-"`
}

func (c Category) MarshalJSON() ([]byte, error) {
	type Alias Category
	var pid *string
	if c.ParentID.Valid {
		pid = &c.ParentID.String
	}
	return json.Marshal(&struct {
		Alias
		ParentID *string `json:"parentId"`
	}{
		Alias:    Alias(c),
		ParentID: pid,
	})
}

// Pagination parameters for list queries.
type Pagination struct {
	Page  int
	Limit int
}

// ListProductsParams input for listing products.
type ListProductsParams struct {
	Pagination
	CategorySlug string
}

// ProductListResult is the paginated result for products.
type ProductListResult struct {
	Items []Product
	Total int
	Page  int
	Limit int
}

type Store struct {
	db *sql.DB

	stmtListProducts           *sql.Stmt
	stmtListProductsByCategory *sql.Stmt
	stmtCountProducts          *sql.Stmt
	stmtCountProductsByCat     *sql.Stmt
	stmtGetProductBySlug       *sql.Stmt
	stmtListCategories         *sql.Stmt
}

func NewStore(ctx context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	// Prepare statements
	stmtList, err := db.PrepareContext(ctx, `
		SELECT p.id, p.slug, p.title, p.description, p.created_at, p.updated_at
		FROM products p
		ORDER BY p.title ASC
		LIMIT $1 OFFSET $2`)
	if err != nil { return nil, err }

	stmtListByCat, err := db.PrepareContext(ctx, `
		SELECT p.id, p.slug, p.title, p.description, p.created_at, p.updated_at
		FROM products p
		JOIN product_categories pc ON pc.product_id = p.id
		JOIN categories c ON c.id = pc.category_id
		WHERE c.slug = $1
		ORDER BY p.title ASC
		LIMIT $2 OFFSET $3`)
	if err != nil { return nil, err }

	stmtCount, err := db.PrepareContext(ctx, `SELECT COUNT(*) FROM products`)
	if err != nil { return nil, err }

	stmtCountByCat, err := db.PrepareContext(ctx, `
		SELECT COUNT(*)
		FROM products p
		JOIN product_categories pc ON pc.product_id = p.id
		JOIN categories c ON c.id = pc.category_id
		WHERE c.slug = $1`)
	if err != nil { return nil, err }

	stmtGetBySlug, err := db.PrepareContext(ctx, `
		SELECT id, slug, title, description, created_at, updated_at
		FROM products WHERE slug = $1`)
	if err != nil { return nil, err }

	stmtListCats, err := db.PrepareContext(ctx, `
		SELECT id, slug, name, parent_id FROM categories ORDER BY name ASC`)
	if err != nil { return nil, err }

	return &Store{
		db:                         db,
		stmtListProducts:           stmtList,
		stmtListProductsByCategory: stmtListByCat,
		stmtCountProducts:          stmtCount,
		stmtCountProductsByCat:     stmtCountByCat,
		stmtGetProductBySlug:       stmtGetBySlug,
		stmtListCategories:         stmtListCats,
	}, nil
}

func (s *Store) Close() error {
	var firstErr error
	closers := []*sql.Stmt{
		s.stmtListProducts,
		s.stmtListProductsByCategory,
		s.stmtCountProducts,
		s.stmtCountProductsByCat,
		s.stmtGetProductBySlug,
		s.stmtListCategories,
	}
	for _, c := range closers {
		if c == nil { continue }
		if err := c.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func sanitizePagination(p Pagination) (page int, limit int, offset int) {
	page = p.Page
	limit = p.Limit
	if page < 1 { page = 1 }
	if limit <= 0 || limit > 100 { limit = 20 }
	offset = (page - 1) * limit
	return
}

func (s *Store) ListProducts(ctx context.Context, in ListProductsParams) (ProductListResult, error) {
	page, limit, offset := sanitizePagination(in.Pagination)
	var (
		rows *sql.Rows
		err  error
		total int
	)
	if in.CategorySlug != "" {
		// Count with category
		if err = s.stmtCountProductsByCat.QueryRowContext(ctx, in.CategorySlug).Scan(&total); err != nil {
			return ProductListResult{}, err
		}
		rows, err = s.stmtListProductsByCategory.QueryContext(ctx, in.CategorySlug, limit, offset)
	} else {
		if err = s.stmtCountProducts.QueryRowContext(ctx).Scan(&total); err != nil {
			return ProductListResult{}, err
		}
		rows, err = s.stmtListProducts.QueryContext(ctx, limit, offset)
	}
	if err != nil { return ProductListResult{}, err }
	defer rows.Close()

	items := make([]Product, 0, limit)
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.Description, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return ProductListResult{}, err
		}
		items = append(items, p)
	}
	if err := rows.Err(); err != nil { return ProductListResult{}, err }

	return ProductListResult{Items: items, Total: total, Page: page, Limit: limit}, nil
}

func (s *Store) GetProductBySlug(ctx context.Context, slug string) (Product, error) {
	var p Product
	err := s.stmtGetProductBySlug.QueryRowContext(ctx, slug).Scan(
		&p.ID, &p.Slug, &p.Title, &p.Description, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil { return Product{}, err }
	return p, nil
}

func (s *Store) ListCategories(ctx context.Context) ([]Category, error) {
	rows, err := s.stmtListCategories.QueryContext(ctx)
	if err != nil { return nil, err }
	defer rows.Close()
	var out []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Slug, &c.Name, &c.ParentID); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil { return nil, err }
	return out, nil
}
