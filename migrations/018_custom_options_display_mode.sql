-- +goose Up
ALTER TABLE product_custom_options
  ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'default';

ALTER TABLE product_custom_options
  ADD CONSTRAINT product_custom_options_display_mode_check
    CHECK (display_mode IN ('default', 'buttons', 'color_buttons'));

ALTER TABLE product_custom_option_values
  ADD COLUMN IF NOT EXISTS swatch_hex text NULL;

-- +goose Down
ALTER TABLE product_custom_option_values
  DROP COLUMN IF EXISTS swatch_hex;

ALTER TABLE product_custom_options
  DROP CONSTRAINT IF EXISTS product_custom_options_display_mode_check;

ALTER TABLE product_custom_options
  DROP COLUMN IF EXISTS display_mode;
