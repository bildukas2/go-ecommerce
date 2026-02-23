-- +goose Up
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_title text NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_sku text NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_attributes_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS custom_options_json jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE order_items oi
SET
	product_title = p.title,
	variant_sku = pv.sku,
	variant_attributes_json = COALESCE(pv.attributes_json, '{}'::jsonb)
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE oi.product_variant_id = pv.id
  AND (oi.product_title = '' OR oi.variant_sku = '' OR oi.variant_attributes_json = '{}'::jsonb);

-- +goose Down
ALTER TABLE order_items DROP COLUMN IF EXISTS custom_options_json;
ALTER TABLE order_items DROP COLUMN IF EXISTS variant_attributes_json;
ALTER TABLE order_items DROP COLUMN IF EXISTS variant_sku;
ALTER TABLE order_items DROP COLUMN IF EXISTS product_title;
