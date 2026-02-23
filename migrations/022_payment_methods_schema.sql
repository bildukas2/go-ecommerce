-- +goose Up
-- Payment type enum
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
    CREATE TYPE payment_type AS ENUM ('manual', 'provider');
  END IF;
END
$$;
-- +goose StatementEnd

-- Payment method name enum
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_name') THEN
    CREATE TYPE payment_method_name AS ENUM ('bank_transfer', 'cash_on_delivery');
  END IF;
END
$$;
-- +goose StatementEnd

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  method_name payment_method_name NOT NULL,
  title text NOT NULL,
  description text,
  instructions text,
  enabled boolean NOT NULL DEFAULT false,
  payment_type payment_type NOT NULL DEFAULT 'manual',
  config_json jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_key ON payment_methods(key);
CREATE INDEX IF NOT EXISTS idx_payment_methods_enabled ON payment_methods(enabled);
CREATE INDEX IF NOT EXISTS idx_payment_methods_method_name ON payment_methods(method_name);

-- +goose Down
DROP INDEX IF EXISTS idx_payment_methods_method_name;
DROP INDEX IF EXISTS idx_payment_methods_enabled;
DROP INDEX IF EXISTS idx_payment_methods_key;
DROP TABLE IF EXISTS payment_methods;

DROP TYPE IF EXISTS payment_method_name;
DROP TYPE IF EXISTS payment_type;
