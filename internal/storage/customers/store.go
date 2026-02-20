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
	ID        string
	Email     string
	CreatedAt time.Time
	UpdatedAt time.Time
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

func (s *Store) ListCustomers(ctx context.Context, limit, offset int) ([]AdminCustomer, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, email, created_at, updated_at
		FROM customers
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AdminCustomer, 0, limit)
	for rows.Next() {
		var item AdminCustomer
		if err := rows.Scan(&item.ID, &item.Email, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
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
