-- +goose Up
CREATE TYPE shipping_pricing_mode_new AS ENUM ('flat', 'free', 'total_tiers', 'weight_tiers', 'provider');

ALTER TABLE shipping_methods
  ALTER COLUMN pricing_mode DROP DEFAULT;

ALTER TABLE shipping_methods
  ALTER COLUMN pricing_mode TYPE shipping_pricing_mode_new
  USING (
    CASE pricing_mode::text
      WHEN 'fixed' THEN 'flat'
      WHEN 'table' THEN 'weight_tiers'
      WHEN 'provider' THEN 'provider'
      ELSE 'flat'
    END
  )::shipping_pricing_mode_new;

DROP TYPE shipping_pricing_mode;
ALTER TYPE shipping_pricing_mode_new RENAME TO shipping_pricing_mode;

ALTER TABLE shipping_methods
  ALTER COLUMN pricing_mode SET DEFAULT 'flat';

-- +goose Down
CREATE TYPE shipping_pricing_mode_old AS ENUM ('fixed', 'table', 'provider');

ALTER TABLE shipping_methods
  ALTER COLUMN pricing_mode DROP DEFAULT;

ALTER TABLE shipping_methods
  ALTER COLUMN pricing_mode TYPE shipping_pricing_mode_old
  USING (
    CASE pricing_mode::text
      WHEN 'flat' THEN 'fixed'
      WHEN 'free' THEN 'fixed'
      WHEN 'total_tiers' THEN 'table'
      WHEN 'weight_tiers' THEN 'table'
      WHEN 'provider' THEN 'provider'
      ELSE 'fixed'
    END
  )::shipping_pricing_mode_old;

DROP TYPE shipping_pricing_mode;
ALTER TYPE shipping_pricing_mode_old RENAME TO shipping_pricing_mode;

ALTER TABLE shipping_methods
  ALTER COLUMN pricing_mode SET DEFAULT 'fixed';
