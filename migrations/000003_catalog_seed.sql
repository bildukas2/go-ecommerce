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
SELECT id, 'TEE-M', 1500, 'EUR', 100, '{"size":"M","color":"Black"}'::jsonb FROM products WHERE slug = 'basic-tee'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_variants (product_id, sku, price_cents, currency, stock, attributes_json)
SELECT id, 'TEE-L', 1500, 'EUR', 100, '{"size":"L","color":"Black"}'::jsonb FROM products WHERE slug = 'basic-tee'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_variants (product_id, sku, price_cents, currency, stock, attributes_json)
SELECT id, 'HOO-S', 4500, 'EUR', 50, '{"size":"S","color":"Gray"}'::jsonb FROM products WHERE slug = 'cozy-hoodie'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_variants (product_id, sku, price_cents, currency, stock, attributes_json)
SELECT id, 'HOO-M', 4500, 'EUR', 50, '{"size":"M","color":"Gray"}'::jsonb FROM products WHERE slug = 'cozy-hoodie'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_variants (product_id, sku, price_cents, currency, stock, attributes_json)
SELECT id, 'HOO-L', 4500, 'EUR', 50, '{"size":"L","color":"Gray"}'::jsonb FROM products WHERE slug = 'cozy-hoodie'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_variants (product_id, sku, price_cents, currency, stock, attributes_json)
SELECT id, 'MUG-STD', 1200, 'EUR', 200, '{"capacity":"350ml","color":"White"}'::jsonb FROM products WHERE slug = 'ceramic-mug'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO images (product_id, url, alt, sort)
SELECT id, 'https://images.example.com/tee-1.jpg', 'Basic Tee front', 1 FROM products WHERE slug = 'basic-tee';
INSERT INTO images (product_id, url, alt, sort)
SELECT id, 'https://images.example.com/tee-2.jpg', 'Basic Tee detail', 2 FROM products WHERE slug = 'basic-tee';
INSERT INTO images (product_id, url, alt, sort)
SELECT id, 'https://images.example.com/hoodie-1.jpg', 'Cozy Hoodie front', 1 FROM products WHERE slug = 'cozy-hoodie';
INSERT INTO images (product_id, url, alt, sort)
SELECT id, 'https://images.example.com/mug-1.jpg', 'Ceramic Mug', 1 FROM products WHERE slug = 'ceramic-mug';

INSERT INTO product_categories (product_id, category_id)
SELECT p.id, c.id FROM products p CROSS JOIN categories c WHERE p.slug = 'basic-tee' AND c.slug = 'apparel'
ON CONFLICT DO NOTHING;
INSERT INTO product_categories (product_id, category_id)
SELECT p.id, c.id FROM products p CROSS JOIN categories c WHERE p.slug = 'cozy-hoodie' AND c.slug = 'apparel'
ON CONFLICT DO NOTHING;
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
