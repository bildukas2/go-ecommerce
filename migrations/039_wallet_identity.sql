-- +goose Up

-- Add wallet address to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS wallet_address text UNIQUE;

-- Wallet-only accounts have no email, so relax the email constraint
-- to also allow wallet_address as an identity substitute.
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_email_required_when_not_anonymous_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_email_required_when_not_anonymous_check
  CHECK (is_anonymous OR email IS NOT NULL OR wallet_address IS NOT NULL);

-- Index for wallet address lookups
CREATE INDEX IF NOT EXISTS idx_customers_wallet_address
  ON customers(wallet_address)
  WHERE wallet_address IS NOT NULL;

-- Short-lived nonces for SIWE login challenges
CREATE TABLE IF NOT EXISTS customer_wallet_nonces (
  nonce      text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_nonces_expires
  ON customer_wallet_nonces(expires_at);

-- +goose Down
DROP INDEX IF EXISTS idx_customer_wallet_nonces_expires;
DROP TABLE IF EXISTS customer_wallet_nonces;
DROP INDEX IF EXISTS idx_customers_wallet_address;

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_email_required_when_not_anonymous_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_email_required_when_not_anonymous_check
  CHECK (is_anonymous OR email IS NOT NULL);

ALTER TABLE customers
  DROP COLUMN IF EXISTS wallet_address;
