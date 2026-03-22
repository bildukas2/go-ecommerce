-- +goose Up
ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS owner_emails text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE email_settings DROP COLUMN IF EXISTS owner_emails;
