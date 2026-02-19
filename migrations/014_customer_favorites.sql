-- +goose Up
CREATE TABLE IF NOT EXISTS customer_favorites (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_favorites_customer_created_at
  ON customer_favorites(customer_id, created_at DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_customer_favorites_customer_created_at;
DROP TABLE IF EXISTS customer_favorites;
