-- +goose Up
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

UPDATE products
SET status = 'published'
WHERE status IS NULL OR btrim(status) = '';

-- +goose Down
ALTER TABLE products
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS status;
