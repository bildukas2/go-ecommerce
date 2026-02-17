-- +goose Up
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS default_image_url text NULL;

UPDATE categories c
SET default_image_url = pick.url
FROM LATERAL (
  SELECT i.url
  FROM product_categories pc
  JOIN images i ON i.product_id = pc.product_id
  WHERE pc.category_id = c.id
  ORDER BY i.sort ASC, i.id ASC
  LIMIT 1
) pick
WHERE c.default_image_url IS NULL;

-- +goose Down
ALTER TABLE categories
DROP COLUMN IF EXISTS default_image_url;
