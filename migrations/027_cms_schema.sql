-- +goose Up
CREATE TABLE IF NOT EXISTS pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    status text NOT NULL CHECK (status IN ('draft', 'published')),
    content_html text NOT NULL DEFAULT '',
    content_json jsonb NULL,
    editor_mode text NOT NULL DEFAULT 'html' CHECK (editor_mode IN ('html', 'visual')),
    meta_title text NULL,
    meta_description text NULL,
    published_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT slug_format CHECK (slug ~ '^/[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT slug_reserved CHECK (slug NOT IN ('/admin', '/checkout', '/api', '/cart', '/account', '/login', '/register'))
);

CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);

CREATE TABLE IF NOT EXISTS navigation_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label text NOT NULL,
    type text NOT NULL CHECK (type IN ('page', 'url')),
    page_id uuid NULL REFERENCES pages(id) ON DELETE RESTRICT,
    url text NULL,
    open_in_new_tab boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_navigation_items_page_id ON navigation_items(page_id);
CREATE INDEX IF NOT EXISTS idx_navigation_items_sort_order ON navigation_items(sort_order);

-- +goose Down
DROP INDEX IF EXISTS idx_navigation_items_sort_order;
DROP INDEX IF EXISTS idx_navigation_items_page_id;
DROP TABLE IF EXISTS navigation_items;

DROP INDEX IF EXISTS idx_pages_status;
DROP INDEX IF EXISTS idx_pages_slug;
DROP TABLE IF EXISTS pages;
