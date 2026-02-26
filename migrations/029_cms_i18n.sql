-- +goose Up
ALTER TABLE pages 
    ADD COLUMN title_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN content_html_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE pages 
SET title_i18n = jsonb_build_object('en', title),
    content_html_i18n = jsonb_build_object('en', content_html);

ALTER TABLE navigation_items 
    ADD COLUMN label_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE navigation_items 
SET label_i18n = jsonb_build_object('en', label);

-- +goose Down
ALTER TABLE pages 
    DROP COLUMN title_i18n,
    DROP COLUMN content_html_i18n;

ALTER TABLE navigation_items 
    DROP COLUMN label_i18n;
