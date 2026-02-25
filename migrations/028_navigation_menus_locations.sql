-- +goose Up
CREATE TABLE IF NOT EXISTS navigation_menus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS navigation_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NULL
);

INSERT INTO navigation_locations (code, name, description) VALUES
    ('header_primary', 'Header Primary', 'Primary header navigation'),
    ('footer_shop', 'Footer Shop', 'Footer shop links'),
    ('footer_info', 'Footer Info', 'Footer informational links'),
    ('mobile', 'Mobile', 'Mobile navigation menu')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS navigation_location_assignments (
    location_code text PRIMARY KEY REFERENCES navigation_locations(code) ON DELETE CASCADE,
    menu_id uuid NOT NULL REFERENCES navigation_menus(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO navigation_menus (code, name, description)
VALUES ('legacy_default', 'Legacy Navigation', 'Auto-created menu for existing navigation items')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE navigation_items
    ADD COLUMN IF NOT EXISTS menu_id uuid,
    ADD COLUMN IF NOT EXISTS category_id uuid;

UPDATE navigation_items
SET menu_id = (SELECT id FROM navigation_menus WHERE code = 'legacy_default' LIMIT 1)
WHERE menu_id IS NULL;

ALTER TABLE navigation_items
    ALTER COLUMN menu_id SET NOT NULL;

ALTER TABLE navigation_items
    DROP CONSTRAINT IF EXISTS fk_navigation_items_menu_id;
ALTER TABLE navigation_items
    ADD CONSTRAINT fk_navigation_items_menu_id
    FOREIGN KEY (menu_id) REFERENCES navigation_menus(id) ON DELETE CASCADE;

ALTER TABLE navigation_items
    DROP CONSTRAINT IF EXISTS fk_navigation_items_category_id;
ALTER TABLE navigation_items
    ADD CONSTRAINT fk_navigation_items_category_id
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;

ALTER TABLE navigation_items
    DROP CONSTRAINT IF EXISTS navigation_items_type_check;
ALTER TABLE navigation_items
    DROP CONSTRAINT IF EXISTS navigation_items_target_check;

ALTER TABLE navigation_items
    ADD CONSTRAINT navigation_items_type_check
    CHECK (type IN ('page', 'url', 'category'));

ALTER TABLE navigation_items
    ADD CONSTRAINT navigation_items_target_check
    CHECK (
        (type = 'page' AND page_id IS NOT NULL AND category_id IS NULL AND url IS NULL) OR
        (type = 'category' AND category_id IS NOT NULL AND page_id IS NULL AND url IS NULL) OR
        (type = 'url' AND url IS NOT NULL AND page_id IS NULL AND category_id IS NULL)
    );

INSERT INTO navigation_location_assignments (location_code, menu_id)
SELECT 'header_primary', m.id
FROM navigation_menus m
WHERE m.code = 'legacy_default'
ON CONFLICT (location_code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_navigation_items_menu_id ON navigation_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_navigation_items_category_id ON navigation_items(category_id);
CREATE INDEX IF NOT EXISTS idx_navigation_items_menu_sort_order ON navigation_items(menu_id, sort_order);

-- +goose Down
DROP INDEX IF EXISTS idx_navigation_items_menu_sort_order;
DROP INDEX IF EXISTS idx_navigation_items_category_id;
DROP INDEX IF EXISTS idx_navigation_items_menu_id;

ALTER TABLE navigation_items DROP CONSTRAINT IF EXISTS navigation_items_target_check;
ALTER TABLE navigation_items DROP CONSTRAINT IF EXISTS navigation_items_type_check;
ALTER TABLE navigation_items ADD CONSTRAINT navigation_items_type_check CHECK (type IN ('page', 'url'));

ALTER TABLE navigation_items DROP CONSTRAINT IF EXISTS fk_navigation_items_category_id;
ALTER TABLE navigation_items DROP CONSTRAINT IF EXISTS fk_navigation_items_menu_id;

ALTER TABLE navigation_items DROP COLUMN IF EXISTS category_id;
ALTER TABLE navigation_items DROP COLUMN IF EXISTS menu_id;

DROP TABLE IF EXISTS navigation_location_assignments;
DROP TABLE IF EXISTS navigation_locations;
DROP TABLE IF EXISTS navigation_menus;
