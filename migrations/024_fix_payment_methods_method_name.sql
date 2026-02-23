-- +goose Up
-- Create payment_method_name enum if it doesn't exist
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_name') THEN
    CREATE TYPE payment_method_name AS ENUM ('bank_transfer', 'cash_on_delivery');
  END IF;
END
$$;
-- +goose StatementEnd

-- Add method_name column if it doesn't exist
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS method_name payment_method_name DEFAULT 'bank_transfer';

-- Update existing rows to have method_name
UPDATE payment_methods SET method_name = 'bank_transfer' WHERE method_name IS NULL;

-- Make method_name NOT NULL
ALTER TABLE payment_methods ALTER COLUMN method_name SET NOT NULL;

-- +goose Down
-- Drop constraint and column
ALTER TABLE payment_methods DROP COLUMN IF EXISTS method_name;

-- Drop enum if no longer used
-- DROP TYPE IF EXISTS payment_method_name;
