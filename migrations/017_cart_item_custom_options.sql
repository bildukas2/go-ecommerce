-- +goose Up
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS custom_options_json jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS custom_options_hash text NOT NULL DEFAULT '';

ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_cart_id_product_variant_id_key;

ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_cart_variant_options_key;

ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_cart_variant_options_key
  UNIQUE (cart_id, product_variant_id, custom_options_hash);

-- +goose Down
ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_cart_variant_options_key;

ALTER TABLE cart_items
  DROP COLUMN IF EXISTS custom_options_hash;

ALTER TABLE cart_items
  DROP COLUMN IF EXISTS custom_options_json;

ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_cart_id_product_variant_id_key
  UNIQUE (cart_id, product_variant_id);
