-- +goose Up
CREATE TABLE IF NOT EXISTS product_custom_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NULL,
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  type_group text NOT NULL,
  type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  price_type text NULL,
  price_value numeric(12,4) NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_custom_options_type_group_check
    CHECK (type_group IN ('text', 'file', 'select', 'date')),
  CONSTRAINT product_custom_options_type_check
    CHECK (type IN ('field', 'area', 'file', 'dropdown', 'radio', 'checkbox', 'multiple', 'date', 'datetime', 'time')),
  CONSTRAINT product_custom_options_type_group_type_matrix_check
    CHECK (
      (type_group = 'text' AND type IN ('field', 'area')) OR
      (type_group = 'file' AND type = 'file') OR
      (type_group = 'select' AND type IN ('dropdown', 'radio', 'checkbox', 'multiple')) OR
      (type_group = 'date' AND type IN ('date', 'datetime', 'time'))
    ),
  CONSTRAINT product_custom_options_price_type_check
    CHECK (price_type IS NULL OR price_type IN ('fixed', 'percent')),
  CONSTRAINT product_custom_options_price_value_nonnegative
    CHECK (price_value IS NULL OR price_value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_custom_options_type_group_active_updated
  ON product_custom_options (type_group, is_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS product_custom_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES product_custom_options(id) ON DELETE CASCADE,
  title text NOT NULL,
  sku text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  price_type text NOT NULL,
  price_value numeric(12,4) NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_custom_option_values_price_type_check
    CHECK (price_type IN ('fixed', 'percent')),
  CONSTRAINT product_custom_option_values_price_value_nonnegative
    CHECK (price_value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_custom_option_values_option_sort
  ON product_custom_option_values (option_id, sort_order, id);

CREATE TABLE IF NOT EXISTS product_custom_option_assignments (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES product_custom_options(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, option_id)
);

CREATE INDEX IF NOT EXISTS idx_product_custom_option_assignments_product_sort
  ON product_custom_option_assignments (product_id, sort_order, option_id);
CREATE INDEX IF NOT EXISTS idx_product_custom_option_assignments_option
  ON product_custom_option_assignments (option_id);

-- +goose Down
DROP INDEX IF EXISTS idx_product_custom_option_assignments_option;
DROP INDEX IF EXISTS idx_product_custom_option_assignments_product_sort;
DROP TABLE IF EXISTS product_custom_option_assignments;

DROP INDEX IF EXISTS idx_product_custom_option_values_option_sort;
DROP TABLE IF EXISTS product_custom_option_values;

DROP INDEX IF EXISTS idx_product_custom_options_type_group_active_updated;
DROP TABLE IF EXISTS product_custom_options;
