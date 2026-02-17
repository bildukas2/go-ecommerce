-- +goose Up
ALTER TABLE images
ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_images_one_default_per_product
ON images (product_id)
WHERE is_default = true;

-- +goose Down
DROP INDEX IF EXISTS idx_images_one_default_per_product;

ALTER TABLE images
DROP COLUMN IF EXISTS is_default;
