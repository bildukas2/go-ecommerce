-- +goose Up
-- Pricing mode enum
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipping_pricing_mode') THEN
    CREATE TYPE shipping_pricing_mode AS ENUM ('fixed', 'table', 'provider');
  END IF;
END
$$;
-- +goose StatementEnd

-- Shipping providers table
CREATE TABLE IF NOT EXISTS shipping_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'live')),
  config_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_providers_key ON shipping_providers(key);
CREATE INDEX IF NOT EXISTS idx_shipping_providers_enabled ON shipping_providers(enabled);

-- Shipping zones table
CREATE TABLE IF NOT EXISTS shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  countries_json jsonb NOT NULL DEFAULT '[]',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_zones_enabled ON shipping_zones(enabled);

-- Shipping methods table
CREATE TABLE IF NOT EXISTS shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  provider_key text NOT NULL REFERENCES shipping_providers(key) ON DELETE RESTRICT,
  service_code text NOT NULL,
  title text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  pricing_mode shipping_pricing_mode NOT NULL DEFAULT 'fixed',
  pricing_rules_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_methods_zone_id ON shipping_methods(zone_id);
CREATE INDEX IF NOT EXISTS idx_shipping_methods_provider_key ON shipping_methods(provider_key);
CREATE INDEX IF NOT EXISTS idx_shipping_methods_enabled ON shipping_methods(enabled);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipping_methods_unique_service ON shipping_methods(zone_id, provider_key, service_code);

-- Shipping terminals cache table
CREATE TABLE IF NOT EXISTS shipping_terminals_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL REFERENCES shipping_providers(key) ON DELETE CASCADE,
  country text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '[]',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipping_terminals_cache_unique ON shipping_terminals_cache(provider_key, country);
CREATE INDEX IF NOT EXISTS idx_shipping_terminals_cache_fetched_at ON shipping_terminals_cache(fetched_at);

-- +goose Down
DROP INDEX IF EXISTS idx_shipping_terminals_cache_fetched_at;
DROP INDEX IF EXISTS idx_shipping_terminals_cache_unique;
DROP TABLE IF EXISTS shipping_terminals_cache;

DROP INDEX IF EXISTS idx_shipping_methods_unique_service;
DROP INDEX IF EXISTS idx_shipping_methods_enabled;
DROP INDEX IF EXISTS idx_shipping_methods_provider_key;
DROP INDEX IF EXISTS idx_shipping_methods_zone_id;
DROP TABLE IF EXISTS shipping_methods;

DROP INDEX IF EXISTS idx_shipping_zones_enabled;
DROP TABLE IF EXISTS shipping_zones;

DROP INDEX IF EXISTS idx_shipping_providers_enabled;
DROP INDEX IF EXISTS idx_shipping_providers_key;
DROP TABLE IF EXISTS shipping_providers;

DROP TYPE IF EXISTS shipping_pricing_mode;
