package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
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
	Status         string
	Tags           []string
	SEOTitle       *string
	SEODescription *string
}

type ProductVariantCreateInput struct {
	SKU        string
	PriceCents int
	Currency   string
	Stock      int
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

const defaultFallbackCategorySlug = "uncategorized"

type AdminCategory struct {
	Category
	ProductCount int64 `json:"product_count"`
}

type DeleteCategoryResult struct {
	DeletedCategoryID   string `json:"deleted_category_id"`
	DeletedCategorySlug string `json:"deleted_category_slug"`
	AffectedProducts    int64  `json:"affected_products"`
	ReassignedProducts  int64  `json:"reassigned_products"`
	FallbackCategory    string `json:"fallback_category"`
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

func (s *Store) ListAdminCategories(ctx context.Context) ([]AdminCategory, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT c.id, c.slug, c.name, c.description, c.parent_id, c.default_image_url, c.seo_title, c.seo_description,
		       COUNT(DISTINCT pc.product_id) AS product_count
		FROM categories c
		LEFT JOIN product_categories pc ON pc.category_id = c.id
		GROUP BY c.id, c.slug, c.name, c.description, c.parent_id, c.default_image_url, c.seo_title, c.seo_description
		ORDER BY c.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AdminCategory, 0, 32)
	for rows.Next() {
		var item AdminCategory
		if err := rows.Scan(
			&item.ID,
			&item.Slug,
			&item.Name,
			&item.Description,
			&item.ParentID,
			&item.DefaultImageURL,
			&item.SEOTitle,
			&item.SEODescription,
			&item.ProductCount,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) DeleteCategory(ctx context.Context, id string) (DeleteCategoryResult, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return DeleteCategoryResult{}, err
	}
	defer tx.Rollback()

	var result DeleteCategoryResult
	if err := tx.QueryRowContext(ctx, `
		SELECT id, slug
		FROM categories
		WHERE id = $1::uuid
	`, id).Scan(&result.DeletedCategoryID, &result.DeletedCategorySlug); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return DeleteCategoryResult{}, ErrNotFound
		}
		return DeleteCategoryResult{}, err
	}
	if result.DeletedCategorySlug == defaultFallbackCategorySlug {
		return DeleteCategoryResult{}, ErrConflict
	}

	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT product_id)
		FROM product_categories
		WHERE category_id = $1::uuid
	`, id).Scan(&result.AffectedProducts); err != nil {
		return DeleteCategoryResult{}, err
	}

	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT pc.product_id)
		FROM product_categories pc
		WHERE pc.category_id = $1::uuid
		  AND NOT EXISTS (
			SELECT 1
			FROM product_categories other
			WHERE other.product_id = pc.product_id
			  AND other.category_id <> $1::uuid
		  )
	`, id).Scan(&result.ReassignedProducts); err != nil {
		return DeleteCategoryResult{}, err
	}

	if result.ReassignedProducts > 0 {
		var fallbackID string
		if err := tx.QueryRowContext(ctx, `
			INSERT INTO categories (slug, name, description)
			VALUES ($1, $2, $3)
			ON CONFLICT (slug) DO UPDATE SET name = categories.name
			RETURNING id
		`, defaultFallbackCategorySlug, "Uncategorized", "Auto-managed fallback category").Scan(&fallbackID); err != nil {
			return DeleteCategoryResult{}, err
		}
		result.FallbackCategory = defaultFallbackCategorySlug

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO product_categories (product_id, category_id)
			SELECT DISTINCT pc.product_id, $2::uuid
			FROM product_categories pc
			WHERE pc.category_id = $1::uuid
			  AND NOT EXISTS (
				SELECT 1
				FROM product_categories other
				WHERE other.product_id = pc.product_id
				  AND other.category_id <> $1::uuid
			  )
			ON CONFLICT DO NOTHING
		`, id, fallbackID); err != nil {
			return DeleteCategoryResult{}, err
		}
	}

	res, err := tx.ExecContext(ctx, `DELETE FROM categories WHERE id = $1::uuid`, id)
	if err != nil {
		return DeleteCategoryResult{}, err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return DeleteCategoryResult{}, ErrNotFound
	}

	if err := tx.Commit(); err != nil {
		return DeleteCategoryResult{}, err
	}
	return result, nil
}

func (s *Store) CreateProduct(ctx context.Context, in ProductUpsertInput) (Product, error) {
	if in.Status == "" {
		in.Status = "published"
	}
	if in.Tags == nil {
		in.Tags = []string{}
	}
	var (
		p              Product
		seoTitle       sql.NullString
		seoDescription sql.NullString
	)
	row := s.db.QueryRowContext(ctx, `
		INSERT INTO products (slug, title, description, status, tags, seo_title, seo_description)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, slug, title, description, status, COALESCE(to_json(tags), '[]'::json), seo_title, seo_description, created_at, updated_at
	`,
		in.Slug,
		in.Title,
		in.Description,
		in.Status,
		in.Tags,
		toNullString(in.SEOTitle),
		toNullString(in.SEODescription),
	)
	var tagsRaw []byte
	if err := row.Scan(&p.ID, &p.Slug, &p.Title, &p.Description, &p.Status, &tagsRaw, &seoTitle, &seoDescription, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if isUniqueViolation(err) {
			return Product{}, ErrConflict
		}
		return Product{}, err
	}
	if len(tagsRaw) > 0 {
		if err := json.Unmarshal(tagsRaw, &p.Tags); err != nil {
			return Product{}, err
		}
	} else {
		p.Tags = []string{}
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
	if in.Status == "" {
		in.Status = "published"
	}
	if in.Tags == nil {
		in.Tags = []string{}
	}
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
			status = $5,
			tags = $6,
			seo_title = $7,
			seo_description = $8,
			updated_at = now()
		WHERE id = $1
		RETURNING id, slug, title, description, status, COALESCE(to_json(tags), '[]'::json), seo_title, seo_description, created_at, updated_at
	`,
		id,
		in.Slug,
		in.Title,
		in.Description,
		in.Status,
		in.Tags,
		toNullString(in.SEOTitle),
		toNullString(in.SEODescription),
	)
	var tagsRaw []byte
	if err := row.Scan(&p.ID, &p.Slug, &p.Title, &p.Description, &p.Status, &tagsRaw, &seoTitle, &seoDescription, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Product{}, ErrNotFound
		}
		if isUniqueViolation(err) {
			return Product{}, ErrConflict
		}
		return Product{}, err
	}
	if len(tagsRaw) > 0 {
		if err := json.Unmarshal(tagsRaw, &p.Tags); err != nil {
			return Product{}, err
		}
	} else {
		p.Tags = []string{}
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

func (s *Store) CreateProductVariant(ctx context.Context, productID string, in ProductVariantCreateInput) (Variant, error) {
	var exists int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM products WHERE id = $1::uuid`, productID).Scan(&exists); err != nil {
		return Variant{}, err
	}
	if exists != 1 {
		return Variant{}, ErrNotFound
	}

	var (
		variant       Variant
		compareAtNull sql.NullInt64
		attrsRaw      []byte
	)
	row := s.db.QueryRowContext(ctx, `
		INSERT INTO product_variants (product_id, sku, price_cents, currency, stock, attributes_json)
		VALUES ($1::uuid, $2, $3, $4, $5, '{}'::jsonb)
		RETURNING id, sku, price_cents, compare_at_price_cents, currency, stock, attributes_json
	`, productID, in.SKU, in.PriceCents, in.Currency, in.Stock)
	if err := row.Scan(&variant.ID, &variant.SKU, &variant.PriceCents, &compareAtNull, &variant.Currency, &variant.Stock, &attrsRaw); err != nil {
		if isUniqueViolation(err) {
			return Variant{}, ErrConflict
		}
		return Variant{}, err
	}
	if compareAtNull.Valid {
		value := int(compareAtNull.Int64)
		variant.CompareAtPriceCents = &value
	}
	variant.Attributes = map[string]interface{}{}
	return variant, nil
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
