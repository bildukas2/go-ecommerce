-- +goose Up
-- Add shipping info to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method_id uuid REFERENCES shipping_methods(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_terminal_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_price_cents integer NOT NULL DEFAULT 0;

-- Add shipping address columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_full_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address1 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address2 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_state text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_postcode text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_country text;

-- Add billing address columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_full_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address1 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address2 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_city text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_state text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_postcode text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_country text;

-- Add company info
ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_vat text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_email text;

-- Add payment method
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider text;

-- +goose Down
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_method_id;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_terminal_id;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_price_cents;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_full_name;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_phone;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_address1;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_address2;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_city;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_state;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_postcode;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_country;
ALTER TABLE orders DROP COLUMN IF EXISTS billing_full_name;
ALTER TABLE orders DROP COLUMN IF EXISTS billing_address1;
ALTER TABLE orders DROP COLUMN IF EXISTS billing_address2;
ALTER TABLE orders DROP COLUMN IF EXISTS billing_city;
ALTER TABLE orders DROP COLUMN IF EXISTS billing_state;
ALTER TABLE orders DROP COLUMN IF EXISTS billing_postcode;
ALTER TABLE orders DROP COLUMN IF EXISTS billing_country;
ALTER TABLE orders DROP COLUMN IF EXISTS company_name;
ALTER TABLE orders DROP COLUMN IF EXISTS company_vat;
ALTER TABLE orders DROP COLUMN IF EXISTS invoice_email;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_method;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_provider;
