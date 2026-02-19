-- +goose Up
-- +goose StatementBegin
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';
-- +goose StatementEnd

-- +goose Down
-- Note: ENUM values cannot be easily removed in Postgres without recreating the type.
-- Since this is a dev/stage migration, we might just leave them or handle it if absolutely necessary.
