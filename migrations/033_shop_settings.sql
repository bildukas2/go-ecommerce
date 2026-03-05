-- +goose Up
CREATE TABLE IF NOT EXISTS shop_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  currency text NOT NULL DEFAULT 'USD',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_settings_singleton CHECK (id = 1),
  CONSTRAINT shop_settings_currency_uppercase CHECK (currency = upper(currency)),
  CONSTRAINT shop_settings_currency_len CHECK (char_length(currency) = 3)
);

INSERT INTO shop_settings (id, currency)
VALUES (1, 'USD')
ON CONFLICT (id) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS shop_settings;
