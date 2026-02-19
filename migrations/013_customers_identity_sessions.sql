-- +goose Up
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires_at ON customer_sessions(expires_at);

ALTER TABLE carts ADD COLUMN IF NOT EXISTS customer_id uuid NULL REFERENCES customers(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_customer_id_unique_not_null ON carts(customer_id) WHERE customer_id IS NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid NULL REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id_created_at ON orders(customer_id, created_at DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_orders_customer_id_created_at;
ALTER TABLE orders DROP COLUMN IF EXISTS customer_id;

DROP INDEX IF EXISTS idx_carts_customer_id_unique_not_null;
ALTER TABLE carts DROP COLUMN IF EXISTS customer_id;

DROP INDEX IF EXISTS idx_customer_sessions_expires_at;
DROP INDEX IF EXISTS idx_customer_sessions_customer_id;
DROP TABLE IF EXISTS customer_sessions;
DROP TABLE IF EXISTS customers;
