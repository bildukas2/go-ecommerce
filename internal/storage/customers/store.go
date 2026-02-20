package customers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrConflict      = errors.New("conflict")
	ErrNotFound      = errors.New("not found")
	ErrProtected     = errors.New("protected")
	ErrGroupAssigned = errors.New("group assigned")
	ErrInvalid       = errors.New("invalid")
)

const systemGuestGroupCode = "not-logged-in"

type Customer struct {
	ID           string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

type Session struct {
	ID         string
	CustomerID string
	TokenHash  string
	ExpiresAt  time.Time
	RevokedAt  sql.NullTime
	CreatedAt  time.Time
}

type Favorite struct {
	ProductID       string
	Slug            string
	Title           string
	DefaultImageURL *string
	PriceCents      *int
	Currency        *string
	CreatedAt       time.Time
}

type FavoritesPage struct {
	Items []Favorite
	Total int
	Page  int
	Limit int
}

type OrderHistoryItem struct {
	ProductID      string
	Slug           string
	Title          string
	Quantity       int
	UnitPriceCents int
	Currency       string
}

type OrderHistoryOrder struct {
	ID         string
	Number     string
	Status     string
	TotalCents int
	Currency   string
	CreatedAt  time.Time
	Items      []OrderHistoryItem
}

type OrdersPage struct {
	Items []OrderHistoryOrder
	Total int
	Page  int
	Limit int
}

type AdminCustomer struct {
	ID               string     `json:"id"`
	Email            *string    `json:"email"`
	Phone            *string    `json:"phone"`
	FirstName        string     `json:"first_name"`
	LastName         string     `json:"last_name"`
	Status           string     `json:"status"`
	GroupID          *string    `json:"group_id"`
	GroupName        *string    `json:"group_name"`
	GroupCode        *string    `json:"group_code"`
	IsAnonymous      bool       `json:"is_anonymous"`
	LastLoginAt      *time.Time `json:"last_login_at"`
	ShippingFullName string     `json:"shipping_full_name"`
	ShippingPhone    string     `json:"shipping_phone"`
	ShippingAddress1 string     `json:"shipping_address1"`
	ShippingAddress2 string     `json:"shipping_address2"`
	ShippingCity     string     `json:"shipping_city"`
	ShippingState    string     `json:"shipping_state"`
	ShippingPostcode string     `json:"shipping_postcode"`
	ShippingCountry  string     `json:"shipping_country"`
	BillingFullName  string     `json:"billing_full_name"`
	BillingAddress1  string     `json:"billing_address1"`
	BillingAddress2  string     `json:"billing_address2"`
	BillingCity      string     `json:"billing_city"`
	BillingState     string     `json:"billing_state"`
	BillingPostcode  string     `json:"billing_postcode"`
	BillingCountry   string     `json:"billing_country"`
	CompanyName      string     `json:"company_name"`
	CompanyVAT       string     `json:"company_vat"`
	InvoiceEmail     *string    `json:"invoice_email"`
	WantsInvoice     bool       `json:"wants_invoice"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type AdminCustomersListParams struct {
	Page      int
	Limit     int
	Query     string
	GroupID   string
	Status    string
	Anonymous string
	Sort      string
}

type AdminCustomersPage struct {
	Items []AdminCustomer `json:"items"`
	Total int             `json:"total"`
	Page  int             `json:"page"`
	Limit int             `json:"limit"`
}

type AdminCustomerUpsertInput struct {
	Email            *string
	Phone            *string
	FirstName        string
	LastName         string
	Status           string
	GroupID          *string
	IsAnonymous      bool
	ShippingFullName string
	ShippingPhone    string
	ShippingAddress1 string
	ShippingAddress2 string
	ShippingCity     string
	ShippingState    string
	ShippingPostcode string
	ShippingCountry  string
	BillingFullName  string
	BillingAddress1  string
	BillingAddress2  string
	BillingCity      string
	BillingState     string
	BillingPostcode  string
	BillingCountry   string
	CompanyName      string
	CompanyVAT       string
	InvoiceEmail     *string
	WantsInvoice     bool
}

type CustomerGroup struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Code          string    `json:"code"`
	IsDefault     bool      `json:"is_default"`
	CustomerCount int64     `json:"customer_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type CustomerActionLog struct {
	ID            string          `json:"id"`
	CustomerID    *string         `json:"customer_id"`
	CustomerEmail *string         `json:"customer_email"`
	IP            string          `json:"ip"`
	UserAgent     *string         `json:"user_agent"`
	Action        string          `json:"action"`
	Severity      *string         `json:"severity"`
	MetaJSON      json.RawMessage `json:"meta_json"`
	CreatedAt     time.Time       `json:"created_at"`
}

type CreateCustomerActionLogInput struct {
	CustomerID *string
	IP         string
	UserAgent  *string
	Action     string
	Severity   *string
	MetaJSON   json.RawMessage
}

type ListCustomerActionLogsParams struct {
	Page   int
	Limit  int
	Query  string
	Action string
	From   *time.Time
	To     *time.Time
}

type CustomerActionLogsPage struct {
	Items []CustomerActionLog `json:"items"`
	Total int                 `json:"total"`
	Page  int                 `json:"page"`
	Limit int                 `json:"limit"`
}

type Store struct {
	db *sql.DB
}

func NewStore(_ context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return nil }

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func (s *Store) CreateCustomer(ctx context.Context, email, passwordHash string) (Customer, error) {
	normalizedEmail := normalizeEmail(email)
	var c Customer
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO customers (email, password_hash)
		VALUES ($1, $2)
		ON CONFLICT (email) DO NOTHING
		RETURNING id, email, password_hash, created_at`, normalizedEmail, passwordHash).
		Scan(&c.ID, &c.Email, &c.PasswordHash, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Customer{}, ErrConflict
		}
		return Customer{}, err
	}
	return c, nil
}

func (s *Store) GetCustomerByEmail(ctx context.Context, email string) (Customer, error) {
	normalizedEmail := normalizeEmail(email)
	var c Customer
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, password_hash, created_at
		FROM customers
		WHERE email = $1`, normalizedEmail).
		Scan(&c.ID, &c.Email, &c.PasswordHash, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Customer{}, ErrNotFound
		}
		return Customer{}, err
	}
	return c, nil
}

func (s *Store) CreateSession(ctx context.Context, customerID, tokenHash string, expiresAt time.Time) (Session, error) {
	var sess Session
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO customer_sessions (customer_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, customer_id, token_hash, expires_at, revoked_at, created_at`, customerID, tokenHash, expiresAt).
		Scan(&sess.ID, &sess.CustomerID, &sess.TokenHash, &sess.ExpiresAt, &sess.RevokedAt, &sess.CreatedAt)
	if err != nil {
		return Session{}, err
	}
	return sess, nil
}

func (s *Store) GetCustomerBySessionTokenHash(ctx context.Context, tokenHash string) (Customer, error) {
	var c Customer
	err := s.db.QueryRowContext(ctx, `
		SELECT c.id, c.email, c.password_hash, c.created_at
		FROM customer_sessions cs
		JOIN customers c ON c.id = cs.customer_id
		WHERE cs.token_hash = $1
		AND cs.revoked_at IS NULL
		AND cs.expires_at > now()`, tokenHash).
		Scan(&c.ID, &c.Email, &c.PasswordHash, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Customer{}, ErrNotFound
		}
		return Customer{}, err
	}
	return c, nil
}

func (s *Store) RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE customer_sessions
		SET revoked_at = now()
		WHERE token_hash = $1 AND revoked_at IS NULL`, tokenHash)
	return err
}

func (s *Store) RevokeSessionsByCustomerID(ctx context.Context, customerID string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE customer_sessions
		SET revoked_at = now()
		WHERE customer_id = $1 AND revoked_at IS NULL`, customerID)
	return err
}

func sanitizePagination(page, limit int) (int, int, int) {
	if page < 1 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return page, limit, (page - 1) * limit
}

func (s *Store) AddFavorite(ctx context.Context, customerID, productID string) (bool, error) {
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO customer_favorites (customer_id, product_id)
		VALUES ($1, $2)
		ON CONFLICT (customer_id, product_id) DO NOTHING
	`, customerID, productID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func (s *Store) RemoveFavorite(ctx context.Context, customerID, productID string) error {
	_, err := s.db.ExecContext(ctx, `
		DELETE FROM customer_favorites
		WHERE customer_id = $1 AND product_id = $2
	`, customerID, productID)
	return err
}

func (s *Store) ListFavorites(ctx context.Context, customerID string, page, limit int) (FavoritesPage, error) {
	page, limit, offset := sanitizePagination(page, limit)
	out := FavoritesPage{Items: []Favorite{}, Page: page, Limit: limit}
	if err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM customer_favorites
		WHERE customer_id = $1
	`, customerID).Scan(&out.Total); err != nil {
		return FavoritesPage{}, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			p.id,
			p.slug,
			p.title,
			(
				SELECT i.url
				FROM images i
				WHERE i.product_id = p.id
				ORDER BY i.is_default DESC, i.sort ASC, i.id ASC
				LIMIT 1
			) AS default_image_url,
			(
				SELECT pv.price_cents
				FROM product_variants pv
				WHERE pv.product_id = p.id
				ORDER BY pv.price_cents ASC, pv.id ASC
				LIMIT 1
			) AS price_cents,
			(
				SELECT pv.currency
				FROM product_variants pv
				WHERE pv.product_id = p.id
				ORDER BY pv.price_cents ASC, pv.id ASC
				LIMIT 1
			) AS currency,
			cf.created_at
		FROM customer_favorites cf
		JOIN products p ON p.id = cf.product_id
		WHERE cf.customer_id = $1
		ORDER BY cf.created_at DESC
		LIMIT $2 OFFSET $3
	`, customerID, limit, offset)
	if err != nil {
		return FavoritesPage{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var item Favorite
		var image sql.NullString
		var price sql.NullInt64
		var currency sql.NullString
		if err := rows.Scan(&item.ProductID, &item.Slug, &item.Title, &image, &price, &currency, &item.CreatedAt); err != nil {
			return FavoritesPage{}, err
		}
		if image.Valid {
			item.DefaultImageURL = &image.String
		}
		if price.Valid {
			v := int(price.Int64)
			item.PriceCents = &v
		}
		if currency.Valid {
			item.Currency = &currency.String
		}
		out.Items = append(out.Items, item)
	}
	if err := rows.Err(); err != nil {
		return FavoritesPage{}, err
	}
	return out, nil
}

func (s *Store) ListOrdersByCustomer(ctx context.Context, customerID string, page, limit int) (OrdersPage, error) {
	page, limit, offset := sanitizePagination(page, limit)
	out := OrdersPage{Items: []OrderHistoryOrder{}, Page: page, Limit: limit}
	if err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM orders
		WHERE customer_id = $1
	`, customerID).Scan(&out.Total); err != nil {
		return OrdersPage{}, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, number, status, total_cents, currency, created_at
		FROM orders
		WHERE customer_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, customerID, limit, offset)
	if err != nil {
		return OrdersPage{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var ord OrderHistoryOrder
		if err := rows.Scan(&ord.ID, &ord.Number, &ord.Status, &ord.TotalCents, &ord.Currency, &ord.CreatedAt); err != nil {
			return OrdersPage{}, err
		}
		items, err := s.listOrderItemsForHistory(ctx, ord.ID)
		if err != nil {
			return OrdersPage{}, err
		}
		ord.Items = items
		out.Items = append(out.Items, ord)
	}
	if err := rows.Err(); err != nil {
		return OrdersPage{}, err
	}
	return out, nil
}

func (s *Store) listOrderItemsForHistory(ctx context.Context, orderID string) ([]OrderHistoryItem, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			p.id,
			p.slug,
			p.title,
			oi.quantity,
			oi.unit_price_cents,
			oi.currency
		FROM order_items oi
		JOIN product_variants pv ON pv.id = oi.product_variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE oi.order_id = $1
		ORDER BY oi.created_at ASC, oi.id ASC
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]OrderHistoryItem, 0, 8)
	for rows.Next() {
		var item OrderHistoryItem
		if err := rows.Scan(&item.ProductID, &item.Slug, &item.Title, &item.Quantity, &item.UnitPriceCents, &item.Currency); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) UpdatePasswordAndRevokeSessions(ctx context.Context, customerID, passwordHash string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.ExecContext(ctx, `
		UPDATE customers
		SET password_hash = $2, updated_at = now()
		WHERE id = $1
	`, customerID, passwordHash)
	if err != nil {
		return err
	}
	changed, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if changed == 0 {
		return ErrNotFound
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE customer_sessions
		SET revoked_at = now()
		WHERE customer_id = $1 AND revoked_at IS NULL
	`, customerID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) ListCustomers(ctx context.Context, in AdminCustomersListParams) (AdminCustomersPage, error) {
	page, limit, offset := sanitizePagination(in.Page, in.Limit)
	out := AdminCustomersPage{
		Items: []AdminCustomer{},
		Page:  page,
		Limit: limit,
	}

	conditions := make([]string, 0, 5)
	args := make([]any, 0, 8)
	appendArg := func(value any) string {
		args = append(args, value)
		return "$" + strconv.Itoa(len(args))
	}

	query := strings.TrimSpace(in.Query)
	if query != "" {
		placeholder := appendArg("%" + query + "%")
		conditions = append(conditions, "(COALESCE(c.email, '') ILIKE "+placeholder+" OR c.first_name ILIKE "+placeholder+" OR c.last_name ILIKE "+placeholder+" OR COALESCE(c.phone, '') ILIKE "+placeholder+")")
	}

	status := strings.ToLower(strings.TrimSpace(in.Status))
	if status == "active" || status == "disabled" {
		placeholder := appendArg(status)
		conditions = append(conditions, "c.status = "+placeholder)
	}

	groupID := strings.TrimSpace(in.GroupID)
	if groupID != "" {
		placeholder := appendArg(groupID)
		conditions = append(conditions, "c.group_id = "+placeholder+"::uuid")
	}

	switch strings.ToLower(strings.TrimSpace(in.Anonymous)) {
	case "anonymous", "true", "1":
		conditions = append(conditions, "c.is_anonymous = true")
	case "registered", "false", "0":
		conditions = append(conditions, "c.is_anonymous = false")
	}

	where := ""
	if len(conditions) > 0 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}

	orderBy := "c.created_at DESC, c.id DESC"
	switch strings.ToLower(strings.TrimSpace(in.Sort)) {
	case "created_asc":
		orderBy = "c.created_at ASC, c.id ASC"
	case "name_asc":
		orderBy = "c.first_name ASC, c.last_name ASC, c.id ASC"
	case "name_desc":
		orderBy = "c.first_name DESC, c.last_name DESC, c.id DESC"
	case "email_asc":
		orderBy = "c.email ASC NULLS LAST, c.id ASC"
	case "email_desc":
		orderBy = "c.email DESC NULLS LAST, c.id DESC"
	case "anonymous_asc":
		orderBy = "c.is_anonymous ASC, c.created_at DESC, c.id DESC"
	case "anonymous_desc":
		orderBy = "c.is_anonymous DESC, c.created_at DESC, c.id DESC"
	}

	countQuery := `
		SELECT COUNT(*)
		FROM customers c
		LEFT JOIN customer_groups cg ON cg.id = c.group_id
	` + where
	if err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&out.Total); err != nil {
		return AdminCustomersPage{}, err
	}

	limitPlaceholder := appendArg(limit)
	offsetPlaceholder := appendArg(offset)
	rowsQuery := `
		SELECT
			c.id,
			c.email,
			c.phone,
			c.first_name,
			c.last_name,
			c.status,
			c.group_id::text,
			cg.name,
			cg.code,
			c.is_anonymous,
			c.last_login_at,
			c.shipping_full_name,
			c.shipping_phone,
			c.shipping_address1,
			c.shipping_address2,
			c.shipping_city,
			c.shipping_state,
			c.shipping_postcode,
			c.shipping_country,
			c.billing_full_name,
			c.billing_address1,
			c.billing_address2,
			c.billing_city,
			c.billing_state,
			c.billing_postcode,
			c.billing_country,
			c.company_name,
			c.company_vat,
			c.invoice_email,
			c.wants_invoice,
			c.created_at,
			c.updated_at
		FROM customers c
		LEFT JOIN customer_groups cg ON cg.id = c.group_id
	` + where + `
		ORDER BY ` + orderBy + `
		LIMIT ` + limitPlaceholder + ` OFFSET ` + offsetPlaceholder

	rows, err := s.db.QueryContext(ctx, rowsQuery, args...)
	if err != nil {
		return AdminCustomersPage{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item         AdminCustomer
			email        sql.NullString
			phone        sql.NullString
			groupIDOut   sql.NullString
			groupName    sql.NullString
			groupCode    sql.NullString
			lastLoginAt  sql.NullTime
			invoiceEmail sql.NullString
		)
		if err := rows.Scan(
			&item.ID,
			&email,
			&phone,
			&item.FirstName,
			&item.LastName,
			&item.Status,
			&groupIDOut,
			&groupName,
			&groupCode,
			&item.IsAnonymous,
			&lastLoginAt,
			&item.ShippingFullName,
			&item.ShippingPhone,
			&item.ShippingAddress1,
			&item.ShippingAddress2,
			&item.ShippingCity,
			&item.ShippingState,
			&item.ShippingPostcode,
			&item.ShippingCountry,
			&item.BillingFullName,
			&item.BillingAddress1,
			&item.BillingAddress2,
			&item.BillingCity,
			&item.BillingState,
			&item.BillingPostcode,
			&item.BillingCountry,
			&item.CompanyName,
			&item.CompanyVAT,
			&invoiceEmail,
			&item.WantsInvoice,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return AdminCustomersPage{}, err
		}
		if email.Valid {
			item.Email = &email.String
		}
		if phone.Valid {
			item.Phone = &phone.String
		}
		if groupIDOut.Valid {
			item.GroupID = &groupIDOut.String
		}
		if groupName.Valid {
			item.GroupName = &groupName.String
		}
		if groupCode.Valid {
			item.GroupCode = &groupCode.String
		}
		if lastLoginAt.Valid {
			item.LastLoginAt = &lastLoginAt.Time
		}
		if invoiceEmail.Valid {
			item.InvoiceEmail = &invoiceEmail.String
		}
		out.Items = append(out.Items, item)
	}
	if err := rows.Err(); err != nil {
		return AdminCustomersPage{}, err
	}
	return out, nil
}

func (s *Store) CreateAdminCustomer(ctx context.Context, in AdminCustomerUpsertInput) (AdminCustomer, error) {
	normalized, err := normalizeAdminCustomerUpsert(in)
	if err != nil {
		return AdminCustomer{}, err
	}

	var item AdminCustomer
	var (
		emailOut       sql.NullString
		phoneOut       sql.NullString
		groupIDOut     sql.NullString
		groupNameOut   sql.NullString
		groupCodeOut   sql.NullString
		lastLoginAtOut sql.NullTime
		invoiceEmail   sql.NullString
	)
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO customers (
			email,
			password_hash,
			phone,
			first_name,
			last_name,
			status,
			group_id,
			is_anonymous,
			shipping_full_name,
			shipping_phone,
			shipping_address1,
			shipping_address2,
			shipping_city,
			shipping_state,
			shipping_postcode,
			shipping_country,
			billing_full_name,
			billing_address1,
			billing_address2,
			billing_city,
			billing_state,
			billing_postcode,
			billing_country,
			company_name,
			company_vat,
			invoice_email,
			wants_invoice
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			$5,
			$6,
			NULLIF($7, '')::uuid,
			$8,
			$9,
			$10,
			$11,
			$12,
			$13,
			$14,
			$15,
			$16,
			$17,
			$18,
			$19,
			$20,
			$21,
			$22,
			$23,
			$24,
			$25,
			$26,
			$27
		)
		RETURNING
			id,
			email,
			phone,
			first_name,
			last_name,
			status,
			group_id::text,
			is_anonymous,
			last_login_at,
			shipping_full_name,
			shipping_phone,
			shipping_address1,
			shipping_address2,
			shipping_city,
			shipping_state,
			shipping_postcode,
			shipping_country,
			billing_full_name,
			billing_address1,
			billing_address2,
			billing_city,
			billing_state,
			billing_postcode,
			billing_country,
			company_name,
			company_vat,
			invoice_email,
			wants_invoice,
			created_at,
			updated_at
	`,
		normalized.Email,
		"admin-created",
		normalized.Phone,
		normalized.FirstName,
		normalized.LastName,
		normalized.Status,
		normalized.GroupID,
		normalized.IsAnonymous,
		normalized.ShippingFullName,
		normalized.ShippingPhone,
		normalized.ShippingAddress1,
		normalized.ShippingAddress2,
		normalized.ShippingCity,
		normalized.ShippingState,
		normalized.ShippingPostcode,
		normalized.ShippingCountry,
		normalized.BillingFullName,
		normalized.BillingAddress1,
		normalized.BillingAddress2,
		normalized.BillingCity,
		normalized.BillingState,
		normalized.BillingPostcode,
		normalized.BillingCountry,
		normalized.CompanyName,
		normalized.CompanyVAT,
		normalized.InvoiceEmail,
		normalized.WantsInvoice,
	).Scan(
		&item.ID,
		&emailOut,
		&phoneOut,
		&item.FirstName,
		&item.LastName,
		&item.Status,
		&groupIDOut,
		&item.IsAnonymous,
		&lastLoginAtOut,
		&item.ShippingFullName,
		&item.ShippingPhone,
		&item.ShippingAddress1,
		&item.ShippingAddress2,
		&item.ShippingCity,
		&item.ShippingState,
		&item.ShippingPostcode,
		&item.ShippingCountry,
		&item.BillingFullName,
		&item.BillingAddress1,
		&item.BillingAddress2,
		&item.BillingCity,
		&item.BillingState,
		&item.BillingPostcode,
		&item.BillingCountry,
		&item.CompanyName,
		&item.CompanyVAT,
		&invoiceEmail,
		&item.WantsInvoice,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return AdminCustomer{}, ErrConflict
		}
		if isForeignKeyViolation(err) {
			return AdminCustomer{}, ErrNotFound
		}
		return AdminCustomer{}, err
	}

	if groupIDOut.Valid {
		item.GroupID = &groupIDOut.String
		if err := s.db.QueryRowContext(ctx, `
			SELECT name, code
			FROM customer_groups
			WHERE id = $1::uuid
		`, groupIDOut.String).Scan(&groupNameOut, &groupCodeOut); err == nil {
			if groupNameOut.Valid {
				item.GroupName = &groupNameOut.String
			}
			if groupCodeOut.Valid {
				item.GroupCode = &groupCodeOut.String
			}
		}
	}
	if emailOut.Valid {
		item.Email = &emailOut.String
	}
	if phoneOut.Valid {
		item.Phone = &phoneOut.String
	}
	if lastLoginAtOut.Valid {
		item.LastLoginAt = &lastLoginAtOut.Time
	}
	if invoiceEmail.Valid {
		item.InvoiceEmail = &invoiceEmail.String
	}
	return item, nil
}

func (s *Store) UpdateAdminCustomer(ctx context.Context, id string, in AdminCustomerUpsertInput) (AdminCustomer, error) {
	normalized, err := normalizeAdminCustomerUpsert(in)
	if err != nil {
		return AdminCustomer{}, err
	}

	var item AdminCustomer
	var (
		emailOut       sql.NullString
		phoneOut       sql.NullString
		groupIDOut     sql.NullString
		groupNameOut   sql.NullString
		groupCodeOut   sql.NullString
		lastLoginAtOut sql.NullTime
		invoiceEmail   sql.NullString
	)
	err = s.db.QueryRowContext(ctx, `
		UPDATE customers
		SET
			email = $2,
			phone = $3,
			first_name = $4,
			last_name = $5,
			status = $6,
			group_id = NULLIF($7, '')::uuid,
			is_anonymous = $8,
			shipping_full_name = $9,
			shipping_phone = $10,
			shipping_address1 = $11,
			shipping_address2 = $12,
			shipping_city = $13,
			shipping_state = $14,
			shipping_postcode = $15,
			shipping_country = $16,
			billing_full_name = $17,
			billing_address1 = $18,
			billing_address2 = $19,
			billing_city = $20,
			billing_state = $21,
			billing_postcode = $22,
			billing_country = $23,
			company_name = $24,
			company_vat = $25,
			invoice_email = $26,
			wants_invoice = $27,
			updated_at = now()
		WHERE id = $1::uuid
		RETURNING
			id,
			email,
			phone,
			first_name,
			last_name,
			status,
			group_id::text,
			is_anonymous,
			last_login_at,
			shipping_full_name,
			shipping_phone,
			shipping_address1,
			shipping_address2,
			shipping_city,
			shipping_state,
			shipping_postcode,
			shipping_country,
			billing_full_name,
			billing_address1,
			billing_address2,
			billing_city,
			billing_state,
			billing_postcode,
			billing_country,
			company_name,
			company_vat,
			invoice_email,
			wants_invoice,
			created_at,
			updated_at
	`,
		id,
		normalized.Email,
		normalized.Phone,
		normalized.FirstName,
		normalized.LastName,
		normalized.Status,
		normalized.GroupID,
		normalized.IsAnonymous,
		normalized.ShippingFullName,
		normalized.ShippingPhone,
		normalized.ShippingAddress1,
		normalized.ShippingAddress2,
		normalized.ShippingCity,
		normalized.ShippingState,
		normalized.ShippingPostcode,
		normalized.ShippingCountry,
		normalized.BillingFullName,
		normalized.BillingAddress1,
		normalized.BillingAddress2,
		normalized.BillingCity,
		normalized.BillingState,
		normalized.BillingPostcode,
		normalized.BillingCountry,
		normalized.CompanyName,
		normalized.CompanyVAT,
		normalized.InvoiceEmail,
		normalized.WantsInvoice,
	).Scan(
		&item.ID,
		&emailOut,
		&phoneOut,
		&item.FirstName,
		&item.LastName,
		&item.Status,
		&groupIDOut,
		&item.IsAnonymous,
		&lastLoginAtOut,
		&item.ShippingFullName,
		&item.ShippingPhone,
		&item.ShippingAddress1,
		&item.ShippingAddress2,
		&item.ShippingCity,
		&item.ShippingState,
		&item.ShippingPostcode,
		&item.ShippingCountry,
		&item.BillingFullName,
		&item.BillingAddress1,
		&item.BillingAddress2,
		&item.BillingCity,
		&item.BillingState,
		&item.BillingPostcode,
		&item.BillingCountry,
		&item.CompanyName,
		&item.CompanyVAT,
		&invoiceEmail,
		&item.WantsInvoice,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AdminCustomer{}, ErrNotFound
		}
		if isUniqueViolation(err) {
			return AdminCustomer{}, ErrConflict
		}
		if isForeignKeyViolation(err) {
			return AdminCustomer{}, ErrNotFound
		}
		return AdminCustomer{}, err
	}

	if groupIDOut.Valid {
		item.GroupID = &groupIDOut.String
		if err := s.db.QueryRowContext(ctx, `
			SELECT name, code
			FROM customer_groups
			WHERE id = $1::uuid
		`, groupIDOut.String).Scan(&groupNameOut, &groupCodeOut); err == nil {
			if groupNameOut.Valid {
				item.GroupName = &groupNameOut.String
			}
			if groupCodeOut.Valid {
				item.GroupCode = &groupCodeOut.String
			}
		}
	}
	if emailOut.Valid {
		item.Email = &emailOut.String
	}
	if phoneOut.Valid {
		item.Phone = &phoneOut.String
	}
	if lastLoginAtOut.Valid {
		item.LastLoginAt = &lastLoginAtOut.Time
	}
	if invoiceEmail.Valid {
		item.InvoiceEmail = &invoiceEmail.String
	}
	return item, nil
}

func (s *Store) UpdateAdminCustomerStatus(ctx context.Context, id, status string) (AdminCustomer, error) {
	normalizedStatus := strings.ToLower(strings.TrimSpace(status))
	if normalizedStatus != "active" && normalizedStatus != "disabled" {
		return AdminCustomer{}, ErrInvalid
	}

	var item AdminCustomer
	var (
		emailOut       sql.NullString
		phoneOut       sql.NullString
		groupIDOut     sql.NullString
		groupNameOut   sql.NullString
		groupCodeOut   sql.NullString
		lastLoginAtOut sql.NullTime
		invoiceEmail   sql.NullString
	)
	err := s.db.QueryRowContext(ctx, `
		UPDATE customers
		SET status = $2, updated_at = now()
		WHERE id = $1::uuid
		RETURNING
			id,
			email,
			phone,
			first_name,
			last_name,
			status,
			group_id::text,
			is_anonymous,
			last_login_at,
			shipping_full_name,
			shipping_phone,
			shipping_address1,
			shipping_address2,
			shipping_city,
			shipping_state,
			shipping_postcode,
			shipping_country,
			billing_full_name,
			billing_address1,
			billing_address2,
			billing_city,
			billing_state,
			billing_postcode,
			billing_country,
			company_name,
			company_vat,
			invoice_email,
			wants_invoice,
			created_at,
			updated_at
	`, id, normalizedStatus).Scan(
		&item.ID,
		&emailOut,
		&phoneOut,
		&item.FirstName,
		&item.LastName,
		&item.Status,
		&groupIDOut,
		&item.IsAnonymous,
		&lastLoginAtOut,
		&item.ShippingFullName,
		&item.ShippingPhone,
		&item.ShippingAddress1,
		&item.ShippingAddress2,
		&item.ShippingCity,
		&item.ShippingState,
		&item.ShippingPostcode,
		&item.ShippingCountry,
		&item.BillingFullName,
		&item.BillingAddress1,
		&item.BillingAddress2,
		&item.BillingCity,
		&item.BillingState,
		&item.BillingPostcode,
		&item.BillingCountry,
		&item.CompanyName,
		&item.CompanyVAT,
		&invoiceEmail,
		&item.WantsInvoice,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AdminCustomer{}, ErrNotFound
		}
		return AdminCustomer{}, err
	}
	if groupIDOut.Valid {
		item.GroupID = &groupIDOut.String
		if err := s.db.QueryRowContext(ctx, `
			SELECT name, code
			FROM customer_groups
			WHERE id = $1::uuid
		`, groupIDOut.String).Scan(&groupNameOut, &groupCodeOut); err == nil {
			if groupNameOut.Valid {
				item.GroupName = &groupNameOut.String
			}
			if groupCodeOut.Valid {
				item.GroupCode = &groupCodeOut.String
			}
		}
	}
	if emailOut.Valid {
		item.Email = &emailOut.String
	}
	if phoneOut.Valid {
		item.Phone = &phoneOut.String
	}
	if lastLoginAtOut.Valid {
		item.LastLoginAt = &lastLoginAtOut.Time
	}
	if invoiceEmail.Valid {
		item.InvoiceEmail = &invoiceEmail.String
	}
	return item, nil
}

func normalizeAdminCustomerUpsert(in AdminCustomerUpsertInput) (AdminCustomerUpsertInput, error) {
	out := in
	out.FirstName = strings.TrimSpace(out.FirstName)
	out.LastName = strings.TrimSpace(out.LastName)
	out.Status = strings.ToLower(strings.TrimSpace(out.Status))
	if out.Status == "" {
		out.Status = "active"
	}
	if out.Status != "active" && out.Status != "disabled" {
		return AdminCustomerUpsertInput{}, ErrInvalid
	}

	out.ShippingFullName = strings.TrimSpace(out.ShippingFullName)
	out.ShippingPhone = strings.TrimSpace(out.ShippingPhone)
	out.ShippingAddress1 = strings.TrimSpace(out.ShippingAddress1)
	out.ShippingAddress2 = strings.TrimSpace(out.ShippingAddress2)
	out.ShippingCity = strings.TrimSpace(out.ShippingCity)
	out.ShippingState = strings.TrimSpace(out.ShippingState)
	out.ShippingPostcode = strings.TrimSpace(out.ShippingPostcode)
	out.ShippingCountry = strings.TrimSpace(out.ShippingCountry)
	out.BillingFullName = strings.TrimSpace(out.BillingFullName)
	out.BillingAddress1 = strings.TrimSpace(out.BillingAddress1)
	out.BillingAddress2 = strings.TrimSpace(out.BillingAddress2)
	out.BillingCity = strings.TrimSpace(out.BillingCity)
	out.BillingState = strings.TrimSpace(out.BillingState)
	out.BillingPostcode = strings.TrimSpace(out.BillingPostcode)
	out.BillingCountry = strings.TrimSpace(out.BillingCountry)
	out.CompanyName = strings.TrimSpace(out.CompanyName)
	out.CompanyVAT = strings.TrimSpace(out.CompanyVAT)

	out.Email = normalizeOptionalEmail(out.Email)
	out.InvoiceEmail = normalizeOptionalEmail(out.InvoiceEmail)
	out.Phone = normalizeOptionalString(out.Phone)
	out.GroupID = normalizeOptionalString(out.GroupID)

	if !out.IsAnonymous && out.Email == nil {
		return AdminCustomerUpsertInput{}, ErrInvalid
	}
	if out.IsAnonymous {
		out.Email = nil
	}

	return out, nil
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeOptionalEmail(value *string) *string {
	normalized := normalizeOptionalString(value)
	if normalized == nil {
		return nil
	}
	email := normalizeEmail(*normalized)
	if email == "" {
		return nil
	}
	return &email
}

func (s *Store) ListCustomerGroups(ctx context.Context) ([]CustomerGroup, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			cg.id,
			cg.name,
			cg.code,
			cg.is_default,
			COUNT(c.id)::bigint AS customer_count,
			cg.created_at,
			cg.updated_at
		FROM customer_groups cg
		LEFT JOIN customers c ON c.group_id = cg.id
		GROUP BY cg.id, cg.name, cg.code, cg.is_default, cg.created_at, cg.updated_at
		ORDER BY cg.created_at ASC, cg.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]CustomerGroup, 0, 8)
	for rows.Next() {
		var item CustomerGroup
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Code,
			&item.IsDefault,
			&item.CustomerCount,
			&item.CreatedAt,
			&item.UpdatedAt,
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

func (s *Store) CreateCustomerGroup(ctx context.Context, name, code string) (CustomerGroup, error) {
	var item CustomerGroup
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO customer_groups (name, code)
		VALUES ($1, $2)
		RETURNING id, name, code, is_default, created_at, updated_at
	`, name, code).Scan(
		&item.ID,
		&item.Name,
		&item.Code,
		&item.IsDefault,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return CustomerGroup{}, ErrConflict
		}
		return CustomerGroup{}, err
	}
	item.CustomerCount = 0
	return item, nil
}

func (s *Store) UpdateCustomerGroup(ctx context.Context, id, name, code string) (CustomerGroup, error) {
	var currentCode string
	if err := s.db.QueryRowContext(ctx, `
		SELECT code
		FROM customer_groups
		WHERE id = $1::uuid
	`, id).Scan(&currentCode); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CustomerGroup{}, ErrNotFound
		}
		return CustomerGroup{}, err
	}
	if currentCode == systemGuestGroupCode {
		return CustomerGroup{}, ErrProtected
	}

	var item CustomerGroup
	err := s.db.QueryRowContext(ctx, `
		UPDATE customer_groups
		SET name = $2,
			code = $3,
			updated_at = now()
		WHERE id = $1::uuid
		RETURNING id, name, code, is_default, created_at, updated_at
	`, id, name, code).Scan(
		&item.ID,
		&item.Name,
		&item.Code,
		&item.IsDefault,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CustomerGroup{}, ErrNotFound
		}
		if isUniqueViolation(err) {
			return CustomerGroup{}, ErrConflict
		}
		return CustomerGroup{}, err
	}

	if err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)::bigint
		FROM customers
		WHERE group_id = $1::uuid
	`, id).Scan(&item.CustomerCount); err != nil {
		return CustomerGroup{}, err
	}
	return item, nil
}

func (s *Store) DeleteCustomerGroup(ctx context.Context, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var code string
	if err := tx.QueryRowContext(ctx, `
		SELECT code
		FROM customer_groups
		WHERE id = $1::uuid
	`, id).Scan(&code); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if code == systemGuestGroupCode {
		return ErrProtected
	}

	var assignedCount int64
	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(*)::bigint
		FROM customers
		WHERE group_id = $1::uuid
	`, id).Scan(&assignedCount); err != nil {
		return err
	}
	if assignedCount > 0 {
		return ErrGroupAssigned
	}

	res, err := tx.ExecContext(ctx, `
		DELETE FROM customer_groups
		WHERE id = $1::uuid
	`, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrNotFound
	}
	return tx.Commit()
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23505"
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23503"
}

func (s *Store) InsertCustomerActionLog(ctx context.Context, in CreateCustomerActionLogInput) (CustomerActionLog, error) {
	ip := strings.TrimSpace(in.IP)
	action := strings.TrimSpace(in.Action)
	if ip == "" || action == "" {
		return CustomerActionLog{}, ErrInvalid
	}

	var customerID string
	if in.CustomerID != nil {
		customerID = strings.TrimSpace(*in.CustomerID)
	}
	userAgent := ""
	if in.UserAgent != nil {
		userAgent = strings.TrimSpace(*in.UserAgent)
	}
	severity := ""
	if in.Severity != nil {
		severity = strings.TrimSpace(*in.Severity)
	}
	metaJSON := in.MetaJSON
	if len(metaJSON) == 0 {
		metaJSON = json.RawMessage(`{}`)
	}

	var item CustomerActionLog
	var (
		customerIDOut sql.NullString
		customerEmail sql.NullString
		userAgentOut  sql.NullString
		severityOut   sql.NullString
		metaRaw       []byte
	)
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO customer_action_logs (
			customer_id,
			ip,
			user_agent,
			action,
			severity,
			meta_json
		)
		VALUES (
			NULLIF($1, '')::uuid,
			$2,
			NULLIF($3, ''),
			$4,
			NULLIF($5, ''),
			$6::jsonb
		)
		RETURNING
			id,
			customer_id::text,
			ip,
			user_agent,
			action,
			severity,
			meta_json,
			created_at
	`, customerID, ip, userAgent, action, severity, metaJSON).Scan(
		&item.ID,
		&customerIDOut,
		&item.IP,
		&userAgentOut,
		&item.Action,
		&severityOut,
		&metaRaw,
		&item.CreatedAt,
	)
	if err != nil {
		return CustomerActionLog{}, err
	}

	if customerIDOut.Valid {
		item.CustomerID = &customerIDOut.String
		if err := s.db.QueryRowContext(ctx, `
			SELECT email
			FROM customers
			WHERE id = $1::uuid
		`, customerIDOut.String).Scan(&customerEmail); err == nil && customerEmail.Valid {
			item.CustomerEmail = &customerEmail.String
		}
	}
	if userAgentOut.Valid {
		item.UserAgent = &userAgentOut.String
	}
	if severityOut.Valid {
		item.Severity = &severityOut.String
	}
	item.MetaJSON = json.RawMessage(metaRaw)
	return item, nil
}

func (s *Store) ListCustomerActionLogs(ctx context.Context, in ListCustomerActionLogsParams) (CustomerActionLogsPage, error) {
	page, limit, offset := sanitizePagination(in.Page, in.Limit)
	out := CustomerActionLogsPage{
		Items: []CustomerActionLog{},
		Page:  page,
		Limit: limit,
	}

	conditions := make([]string, 0, 4)
	args := make([]any, 0, 8)
	appendArg := func(value any) string {
		args = append(args, value)
		return "$" + strconv.Itoa(len(args))
	}

	query := strings.TrimSpace(in.Query)
	if query != "" {
		placeholder := appendArg("%" + query + "%")
		conditions = append(conditions, "(cal.action ILIKE "+placeholder+" OR cal.ip ILIKE "+placeholder+" OR COALESCE(c.email, '') ILIKE "+placeholder+")")
	}
	action := strings.TrimSpace(in.Action)
	if action != "" {
		placeholder := appendArg(action)
		conditions = append(conditions, "cal.action = "+placeholder)
	}
	if in.From != nil {
		placeholder := appendArg(*in.From)
		conditions = append(conditions, "cal.created_at >= "+placeholder)
	}
	if in.To != nil {
		placeholder := appendArg(*in.To)
		conditions = append(conditions, "cal.created_at <= "+placeholder)
	}

	where := ""
	if len(conditions) > 0 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := `
		SELECT COUNT(*)
		FROM customer_action_logs cal
		LEFT JOIN customers c ON c.id = cal.customer_id
	` + where
	if err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&out.Total); err != nil {
		return CustomerActionLogsPage{}, err
	}

	limitPlaceholder := appendArg(limit)
	offsetPlaceholder := appendArg(offset)
	rowsQuery := `
		SELECT
			cal.id,
			cal.customer_id::text,
			c.email,
			cal.ip,
			cal.user_agent,
			cal.action,
			cal.severity,
			cal.meta_json,
			cal.created_at
		FROM customer_action_logs cal
		LEFT JOIN customers c ON c.id = cal.customer_id
	` + where + `
		ORDER BY cal.created_at DESC, cal.id DESC
		LIMIT ` + limitPlaceholder + ` OFFSET ` + offsetPlaceholder

	rows, err := s.db.QueryContext(ctx, rowsQuery, args...)
	if err != nil {
		return CustomerActionLogsPage{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var item CustomerActionLog
		var (
			customerID sql.NullString
			email      sql.NullString
			userAgent  sql.NullString
			severity   sql.NullString
			metaRaw    []byte
		)
		if err := rows.Scan(
			&item.ID,
			&customerID,
			&email,
			&item.IP,
			&userAgent,
			&item.Action,
			&severity,
			&metaRaw,
			&item.CreatedAt,
		); err != nil {
			return CustomerActionLogsPage{}, err
		}
		if customerID.Valid {
			item.CustomerID = &customerID.String
		}
		if email.Valid {
			item.CustomerEmail = &email.String
		}
		if userAgent.Valid {
			item.UserAgent = &userAgent.String
		}
		if severity.Valid {
			item.Severity = &severity.String
		}
		item.MetaJSON = json.RawMessage(metaRaw)
		out.Items = append(out.Items, item)
	}
	if err := rows.Err(); err != nil {
		return CustomerActionLogsPage{}, err
	}

	return out, nil
}
