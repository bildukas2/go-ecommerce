package catalog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrNotFound = errors.New("catalog not found")
	ErrConflict = errors.New("catalog conflict")
)

type CategoryUpsertInput struct {
	Slug            string
	Name            string
	Description     string
	ParentID        *string
	DefaultImageURL *string
	SEOTitle        *string
	SEODescription  *string
}

type ProductUpsertInput struct {
	Slug           string
	Title          string
	Description    string
	SEOTitle       *string
	SEODescription *string
}

type DiscountMode string

const (
	DiscountModePrice   DiscountMode = "price"
	DiscountModePercent DiscountMode = "percent"
)

type ProductDiscountInput struct {
	Mode               DiscountMode
	DiscountPriceCents *int
	DiscountPercent    *float64
}

func (s *Store) CreateCategory(ctx context.Context, in CategoryUpsertInput) (Category, error) {
	var c Category
	row := s.db.QueryRowContext(ctx, `
		INSERT INTO categories (slug, name, description, parent_id, default_image_url, seo_title, seo_description)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, slug, name, description, parent_id, default_image_url, seo_title, seo_description
	`,
		in.Slug,
		in.Name,
		in.Description,
		toNullString(in.ParentID),
		toNullString(in.DefaultImageURL),
		toNullString(in.SEOTitle),
		toNullString(in.SEODescription),
	)
	if err := row.Scan(&c.ID, &c.Slug, &c.Name, &c.Description, &c.ParentID, &c.DefaultImageURL, &c.SEOTitle, &c.SEODescription); err != nil {
		if isUniqueViolation(err) {
			return Category{}, ErrConflict
		}
		return Category{}, err
	}
	return c, nil
}

func (s *Store) UpdateCategory(ctx context.Context, id string, in CategoryUpsertInput) (Category, error) {
	var c Category
	row := s.db.QueryRowContext(ctx, `
		UPDATE categories
		SET slug = $2,
			name = $3,
			description = $4,
			parent_id = $5,
			default_image_url = $6,
			seo_title = $7,
			seo_description = $8
		WHERE id = $1
		RETURNING id, slug, name, description, parent_id, default_image_url, seo_title, seo_description
	`,
		id,
		in.Slug,
		in.Name,
		in.Description,
		toNullString(in.ParentID),
		toNullString(in.DefaultImageURL),
		toNullString(in.SEOTitle),
		toNullString(in.SEODescription),
	)
	if err := row.Scan(&c.ID, &c.Slug, &c.Name, &c.Description, &c.ParentID, &c.DefaultImageURL, &c.SEOTitle, &c.SEODescription); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Category{}, ErrNotFound
		}
		if isUniqueViolation(err) {
			return Category{}, ErrConflict
		}
		return Category{}, err
	}
	return c, nil
}

func (s *Store) CreateProduct(ctx context.Context, in ProductUpsertInput) (Product, error) {
	var (
		p              Product
		seoTitle       sql.NullString
		seoDescription sql.NullString
	)
	row := s.db.QueryRowContext(ctx, `
		INSERT INTO products (slug, title, description, seo_title, seo_description)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, slug, title, description, seo_title, seo_description, created_at, updated_at
	`,
		in.Slug,
		in.Title,
		in.Description,
		toNullString(in.SEOTitle),
		toNullString(in.SEODescription),
	)
	if err := row.Scan(&p.ID, &p.Slug, &p.Title, &p.Description, &seoTitle, &seoDescription, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if isUniqueViolation(err) {
			return Product{}, ErrConflict
		}
		return Product{}, err
	}
	if seoTitle.Valid {
		p.SEOTitle = &seoTitle.String
	}
	if seoDescription.Valid {
		p.SEODescription = &seoDescription.String
	}
	p.Variants = []Variant{}
	p.Images = []Image{}
	return p, nil
}

func (s *Store) UpdateProduct(ctx context.Context, id string, in ProductUpsertInput) (Product, error) {
	var (
		p              Product
		seoTitle       sql.NullString
		seoDescription sql.NullString
	)
	row := s.db.QueryRowContext(ctx, `
		UPDATE products
		SET slug = $2,
			title = $3,
			description = $4,
			seo_title = $5,
			seo_description = $6,
			updated_at = now()
		WHERE id = $1
		RETURNING id, slug, title, description, seo_title, seo_description, created_at, updated_at
	`,
		id,
		in.Slug,
		in.Title,
		in.Description,
		toNullString(in.SEOTitle),
		toNullString(in.SEODescription),
	)
	if err := row.Scan(&p.ID, &p.Slug, &p.Title, &p.Description, &seoTitle, &seoDescription, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Product{}, ErrNotFound
		}
		if isUniqueViolation(err) {
			return Product{}, ErrConflict
		}
		return Product{}, err
	}
	if seoTitle.Valid {
		p.SEOTitle = &seoTitle.String
	}
	if seoDescription.Valid {
		p.SEODescription = &seoDescription.String
	}
	p.Variants = []Variant{}
	p.Images = []Image{}
	return p, nil
}

func (s *Store) ReplaceProductCategories(ctx context.Context, productID string, categoryIDs []string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var productCount int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM products WHERE id = $1::uuid`, productID).Scan(&productCount); err != nil {
		return err
	}
	if productCount != 1 {
		return ErrNotFound
	}

	if len(categoryIDs) > 0 {
		var categoryCount int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM categories WHERE id = ANY($1::uuid[])`, categoryIDs).Scan(&categoryCount); err != nil {
			return err
		}
		if categoryCount != len(uniqueStrings(categoryIDs)) {
			return ErrNotFound
		}
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM product_categories WHERE product_id = $1::uuid`, productID); err != nil {
		return err
	}
	if len(categoryIDs) > 0 {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO product_categories (product_id, category_id)
			SELECT $1::uuid, unnest($2::uuid[])
			ON CONFLICT DO NOTHING
		`, productID, uniqueStrings(categoryIDs)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) BulkAssignProductCategories(ctx context.Context, productIDs []string, categoryIDs []string) (int64, error) {
	productIDs = uniqueStrings(productIDs)
	categoryIDs = uniqueStrings(categoryIDs)
	if len(productIDs) == 0 || len(categoryIDs) == 0 {
		return 0, nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if err := ensureProductsAndCategoriesExist(ctx, tx, productIDs, categoryIDs); err != nil {
		return 0, err
	}

	res, err := tx.ExecContext(ctx, `
		INSERT INTO product_categories (product_id, category_id)
		SELECT p.id, c.id
		FROM unnest($1::uuid[]) AS p(id)
		CROSS JOIN unnest($2::uuid[]) AS c(id)
		ON CONFLICT DO NOTHING
	`, productIDs, categoryIDs)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	affected, _ := res.RowsAffected()
	return affected, nil
}

func (s *Store) BulkRemoveProductCategories(ctx context.Context, productIDs []string, categoryIDs []string) (int64, error) {
	productIDs = uniqueStrings(productIDs)
	categoryIDs = uniqueStrings(categoryIDs)
	if len(productIDs) == 0 || len(categoryIDs) == 0 {
		return 0, nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if err := ensureProductsAndCategoriesExist(ctx, tx, productIDs, categoryIDs); err != nil {
		return 0, err
	}

	res, err := tx.ExecContext(ctx, `
		DELETE FROM product_categories
		WHERE product_id = ANY($1::uuid[])
		  AND category_id = ANY($2::uuid[])
	`, productIDs, categoryIDs)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	affected, _ := res.RowsAffected()
	return affected, nil
}

func (s *Store) ApplyDiscountToProducts(ctx context.Context, productIDs []string, in ProductDiscountInput) (int64, error) {
	productIDs = uniqueStrings(productIDs)
	if len(productIDs) == 0 {
		return 0, nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var productCount int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM products WHERE id = ANY($1::uuid[])`, productIDs).Scan(&productCount); err != nil {
		return 0, err
	}
	if productCount != len(productIDs) {
		return 0, ErrNotFound
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT id, price_cents, compare_at_price_cents
		FROM product_variants
		WHERE product_id = ANY($1::uuid[])
		FOR UPDATE
	`, productIDs)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type variantRow struct {
		id        string
		price     int
		compareAt sql.NullInt64
	}
	var variants []variantRow
	for rows.Next() {
		var row variantRow
		if err := rows.Scan(&row.id, &row.price, &row.compareAt); err != nil {
			return 0, err
		}
		variants = append(variants, row)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if len(variants) == 0 {
		return 0, ErrNotFound
	}

	var updated int64
	for _, variant := range variants {
		basePrice := variant.price
		if variant.compareAt.Valid {
			basePrice = int(variant.compareAt.Int64)
		}
		nextPrice, ok := calculateDiscountedPrice(basePrice, in)
		if !ok {
			return 0, fmt.Errorf("invalid discount for variant %s", variant.id)
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE product_variants
			SET compare_at_price_cents = $2,
				price_cents = $3
			WHERE id = $1::uuid
		`, variant.id, basePrice, nextPrice); err != nil {
			return 0, err
		}
		updated++
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return updated, nil
}

func ensureProductsAndCategoriesExist(ctx context.Context, tx *sql.Tx, productIDs []string, categoryIDs []string) error {
	var productCount int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM products WHERE id = ANY($1::uuid[])`, productIDs).Scan(&productCount); err != nil {
		return err
	}
	if productCount != len(productIDs) {
		return ErrNotFound
	}

	var categoryCount int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM categories WHERE id = ANY($1::uuid[])`, categoryIDs).Scan(&categoryCount); err != nil {
		return err
	}
	if categoryCount != len(categoryIDs) {
		return ErrNotFound
	}
	return nil
}

func calculateDiscountedPrice(basePrice int, in ProductDiscountInput) (int, bool) {
	if basePrice < 0 {
		return 0, false
	}
	switch in.Mode {
	case DiscountModePrice:
		if in.DiscountPriceCents == nil {
			return 0, false
		}
		discounted := *in.DiscountPriceCents
		if discounted < 0 || discounted >= basePrice {
			return 0, false
		}
		return discounted, true
	case DiscountModePercent:
		if in.DiscountPercent == nil {
			return 0, false
		}
		percent := *in.DiscountPercent
		if percent <= 0 || percent >= 100 {
			return 0, false
		}
		discounted := int(math.Round(float64(basePrice) * (1.0 - (percent / 100.0))))
		if discounted < 0 {
			discounted = 0
		}
		if discounted >= basePrice {
			return 0, false
		}
		return discounted, true
	default:
		return 0, false
	}
}

func toNullString(v *string) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	trimmed := *v
	if trimmed == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: trimmed, Valid: true}
}

func uniqueStrings(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, id := range in {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23505"
}
