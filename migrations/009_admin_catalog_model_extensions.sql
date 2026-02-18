-- +goose Up
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_title text NULL,
  ADD COLUMN IF NOT EXISTS seo_description text NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_title text NULL,
  ADD COLUMN IF NOT EXISTS seo_description text NULL;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS compare_at_price_cents integer NULL;

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_compare_at_price_cents_nonnegative;
ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_compare_at_price_cents_nonnegative
  CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= 0);

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_compare_at_price_cents_gte_price_cents;
ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_compare_at_price_cents_gte_price_cents
  CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents >= price_cents);

-- +goose Down
ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_compare_at_price_cents_gte_price_cents;
ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_compare_at_price_cents_nonnegative;
ALTER TABLE product_variants
  DROP COLUMN IF EXISTS compare_at_price_cents;

ALTER TABLE products
  DROP COLUMN IF EXISTS seo_description,
  DROP COLUMN IF EXISTS seo_title;

ALTER TABLE categories
  DROP COLUMN IF EXISTS seo_description,
  DROP COLUMN IF EXISTS seo_title,
  DROP COLUMN IF EXISTS description;
