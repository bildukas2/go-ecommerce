-- +goose Up
CREATE TABLE IF NOT EXISTS customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS phone text NULL,
  ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS group_id uuid NULL,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS shipping_full_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_address1 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_address2 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_postcode text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_country text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_full_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_address1 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_address2 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_postcode text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_country text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_vat text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS invoice_email text NULL,
  ADD COLUMN IF NOT EXISTS wants_invoice boolean NOT NULL DEFAULT false;

-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_status_check'
      AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_status_check
      CHECK (status IN ('active', 'disabled'));
  END IF;
END $$;
-- +goose StatementEnd

-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_email_required_when_not_anonymous_check'
      AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_email_required_when_not_anonymous_check
      CHECK (is_anonymous OR email IS NOT NULL);
  END IF;
END $$;
-- +goose StatementEnd

-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_group_id_fkey'
      AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES customer_groups(id) ON DELETE SET NULL;
  END IF;
END $$;
-- +goose StatementEnd

CREATE INDEX IF NOT EXISTS idx_customers_group_id ON customers(group_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_is_anonymous ON customers(is_anonymous);
CREATE INDEX IF NOT EXISTS idx_customers_last_login_at ON customers(last_login_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS customer_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NULL REFERENCES customers(id) ON DELETE SET NULL,
  ip text NOT NULL,
  user_agent text NULL,
  action text NOT NULL,
  severity text NULL,
  meta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_action_logs_severity_check'
      AND conrelid = 'customer_action_logs'::regclass
  ) THEN
    ALTER TABLE customer_action_logs
      ADD CONSTRAINT customer_action_logs_severity_check
      CHECK (severity IS NULL OR severity IN ('info', 'warn', 'security'));
  END IF;
END $$;
-- +goose StatementEnd

CREATE INDEX IF NOT EXISTS idx_customer_action_logs_customer_created_at
  ON customer_action_logs(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_action_logs_action_created_at
  ON customer_action_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_action_logs_ip_created_at
  ON customer_action_logs(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_action_logs_created_at
  ON customer_action_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  reason text NULL,
  created_by_admin_id uuid NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires_at
  ON blocked_ips(expires_at);

CREATE TABLE IF NOT EXISTS blocked_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_reports_created_at
  ON blocked_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocked_reports_ip_created_at
  ON blocked_reports(ip, created_at DESC);

INSERT INTO customer_groups (name, code, is_default)
VALUES
  ('NOT LOGGED IN', 'not-logged-in', true),
  ('General', 'general', true),
  ('Wholesale', 'wholesale', false),
  ('Retailer', 'retailer', false)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  is_default = EXCLUDED.is_default,
  updated_at = now();

-- +goose Down
DELETE FROM customer_groups
WHERE code IN ('retailer', 'wholesale', 'general', 'not-logged-in');

DROP INDEX IF EXISTS idx_blocked_reports_ip_created_at;
DROP INDEX IF EXISTS idx_blocked_reports_created_at;
DROP TABLE IF EXISTS blocked_reports;

DROP INDEX IF EXISTS idx_blocked_ips_expires_at;
DROP TABLE IF EXISTS blocked_ips;

DROP INDEX IF EXISTS idx_customer_action_logs_created_at;
DROP INDEX IF EXISTS idx_customer_action_logs_ip_created_at;
DROP INDEX IF EXISTS idx_customer_action_logs_action_created_at;
DROP INDEX IF EXISTS idx_customer_action_logs_customer_created_at;
ALTER TABLE IF EXISTS customer_action_logs DROP CONSTRAINT IF EXISTS customer_action_logs_severity_check;
DROP TABLE IF EXISTS customer_action_logs;

DROP INDEX IF EXISTS idx_customers_last_login_at;
DROP INDEX IF EXISTS idx_customers_is_anonymous;
DROP INDEX IF EXISTS idx_customers_status;
DROP INDEX IF EXISTS idx_customers_group_id;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_group_id_fkey;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_required_when_not_anonymous_check;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_status_check;

ALTER TABLE customers
  DROP COLUMN IF EXISTS wants_invoice,
  DROP COLUMN IF EXISTS invoice_email,
  DROP COLUMN IF EXISTS company_vat,
  DROP COLUMN IF EXISTS company_name,
  DROP COLUMN IF EXISTS billing_country,
  DROP COLUMN IF EXISTS billing_postcode,
  DROP COLUMN IF EXISTS billing_state,
  DROP COLUMN IF EXISTS billing_city,
  DROP COLUMN IF EXISTS billing_address2,
  DROP COLUMN IF EXISTS billing_address1,
  DROP COLUMN IF EXISTS billing_full_name,
  DROP COLUMN IF EXISTS shipping_country,
  DROP COLUMN IF EXISTS shipping_postcode,
  DROP COLUMN IF EXISTS shipping_state,
  DROP COLUMN IF EXISTS shipping_city,
  DROP COLUMN IF EXISTS shipping_address2,
  DROP COLUMN IF EXISTS shipping_address1,
  DROP COLUMN IF EXISTS shipping_phone,
  DROP COLUMN IF EXISTS shipping_full_name,
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS is_anonymous,
  DROP COLUMN IF EXISTS group_id,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS phone;

ALTER TABLE customers
  ALTER COLUMN email SET NOT NULL;

DROP TABLE IF EXISTS customer_groups;
