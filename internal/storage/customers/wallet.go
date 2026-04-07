package customers

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// SaveWalletNonce stores a one-time nonce for SIWE challenge (5 min TTL).
func (s *Store) SaveWalletNonce(ctx context.Context, nonce string, expiresAt time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO customer_wallet_nonces (nonce, expires_at) VALUES ($1, $2)`,
		nonce, expiresAt,
	)
	return err
}

// ConsumeWalletNonce atomically deletes the nonce if it exists and is not expired.
// Returns ErrNotFound if the nonce is missing or already expired.
func (s *Store) ConsumeWalletNonce(ctx context.Context, nonce string) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM customer_wallet_nonces WHERE nonce = $1 AND expires_at > now()`,
		nonce,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// GetCustomerByWalletAddress looks up a customer by their Ethereum wallet address.
func (s *Store) GetCustomerByWalletAddress(ctx context.Context, address string) (Customer, error) {
	var c Customer
	err := s.db.QueryRowContext(ctx,
		`SELECT id, COALESCE(email, ''), COALESCE(password_hash, ''), status, created_at
		 FROM customers
		 WHERE wallet_address = $1
		 LIMIT 1`,
		address,
	).Scan(&c.ID, &c.Email, &c.PasswordHash, &c.Status, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Customer{}, ErrNotFound
	}
	return c, err
}

// CreateCustomerWithWallet creates a new customer record identified only by wallet address.
func (s *Store) CreateCustomerWithWallet(ctx context.Context, walletAddress string) (Customer, error) {
	var c Customer
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO customers (wallet_address, password_hash, status)
		 VALUES ($1, '', 'active')
		 RETURNING id, COALESCE(email, ''), password_hash, status, created_at`,
		walletAddress,
	).Scan(&c.ID, &c.Email, &c.PasswordHash, &c.Status, &c.CreatedAt)
	return c, err
}

// LinkWalletToCustomer associates a wallet address with an existing customer account.
func (s *Store) LinkWalletToCustomer(ctx context.Context, customerID, walletAddress string) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE customers SET wallet_address = $1, updated_at = now() WHERE id = $2`,
		walletAddress, customerID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
