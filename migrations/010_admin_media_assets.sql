-- +goose Up
CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  alt text NOT NULL DEFAULT '',
  source_type text NOT NULL,
  source_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_source_type_check CHECK (source_type IN ('upload', 'url_import'))
);

CREATE INDEX IF NOT EXISTS idx_media_assets_created_at_desc ON media_assets (created_at DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_media_assets_created_at_desc;
DROP TABLE IF EXISTS media_assets;
