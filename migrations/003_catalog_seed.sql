-- +goose Up
INSERT INTO categories (slug, name) VALUES
  ('apparel', 'Apparel'),
  ('accessories', 'Accessories'),
  ('home', 'Home')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (slug, title, description) VALUES
  ('basic-tee', 'Basic Tee', 'Soft cotton tee in multiple sizes'),
  ('cozy-hoodie', 'Cozy Hoodie', 'Warm hoodie with front pocket'),
  ('ceramic-mug', 'Ceramic Mug', 'Durable mug for hot drinks')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_variants (product_id, sku, price_cents, currency, stock, attributes_json)
SELECT id, 'TEE-S', 1500, 'EUR', 100, '{"size":"S","color":"Black"}'::jsonb FROM products WHERE slug = 'basic-tee'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_variants (product_id, sku, price_cents, currency, stock, attributes_json)
SELECT id, 'HOO-S', 4500, 'EUR', 50, '{"size":"S","color":"Gray"}'::jsonb FROM products WHERE slug = 'cozy-hoodie'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_variants (product_id, sku, price_cents, currency, stock, attributes_json)
SELECT id, 'HOO-L', 4500, 'EUR', 50, '{"size":"L","color":"Gray"}'::jsonb FROM products WHERE slug = 'cozy-hoodie'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_categories (product_id, category_id)
SELECT p.id, c.id FROM products p CROSS JOIN categories c WHERE p.slug = 'ceramic-mug' AND c.slug = 'home'
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM product_categories WHERE product_id IN (
  SELECT id FROM products WHERE slug IN ('basic-tee','cozy-hoodie','ceramic-mug')
);
DELETE FROM images WHERE product_id IN (
  SELECT id FROM products WHERE slug IN ('basic-tee','cozy-hoodie','ceramic-mug')
);
DELETE FROM product_variants WHERE product_id IN (
  SELECT id FROM products WHERE slug IN ('basic-tee','cozy-hoodie','ceramic-mug')
);
DELETE FROM products WHERE slug IN ('basic-tee','cozy-hoodie','ceramic-mug');
DELETE FROM categories WHERE slug IN ('apparel','accessories','home');
