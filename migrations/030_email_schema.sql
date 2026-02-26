-- +goose Up
CREATE TABLE IF NOT EXISTS email_settings (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    driver text NOT NULL DEFAULT 'mailpit' CHECK (driver IN ('mailpit', 'smtp')),
    smtp_host text NOT NULL DEFAULT 'localhost',
    smtp_port integer NOT NULL DEFAULT 1025 CHECK (smtp_port > 0 AND smtp_port <= 65535),
    smtp_username text NOT NULL DEFAULT '',
    smtp_password text NOT NULL DEFAULT '',
    from_name text NOT NULL DEFAULT 'Store',
    from_email text NOT NULL DEFAULT 'noreply@example.com',
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO email_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS email_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    subject_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
    body_html_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT email_templates_subject_i18n_object CHECK (jsonb_typeof(subject_i18n) = 'object'),
    CONSTRAINT email_templates_body_html_i18n_object CHECK (jsonb_typeof(body_html_i18n) = 'object')
);

INSERT INTO email_templates (code, name, subject_i18n, body_html_i18n)
VALUES
(
    'order_confirmation',
    'Order Confirmation',
    '{"en":"Your order {{.OrderNumber}} is confirmed","lt":"Jusu uzsakymas {{.OrderNumber}} patvirtintas"}'::jsonb,
    '{"en":"<h1>Thank you for your order!</h1><p>Order: {{.OrderNumber}}</p>","lt":"<h1>Aciu uz uzsakyma!</h1><p>Uzsakymas: {{.OrderNumber}}</p>"}'::jsonb
),
(
    'order_shipped',
    'Order Shipped',
    '{"en":"Your order {{.OrderNumber}} has shipped","lt":"Jusu uzsakymas {{.OrderNumber}} issiustas"}'::jsonb,
    '{"en":"<h1>Your order is on the way!</h1>","lt":"<h1>Jusu uzsakymas keliauja!</h1>"}'::jsonb
),
(
    'password_reset',
    'Password Reset',
    '{"en":"Reset your password","lt":"Atstatyti slaptazodi"}'::jsonb,
    '{"en":"<h1>Reset Password</h1><p><a href=\"{{.ResetURL}}\">Click here</a></p>","lt":"<h1>Atstatyti slaptazodi</h1><p><a href=\"{{.ResetURL}}\">Spauskite cia</a></p>"}'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS email_templates;
DROP TABLE IF EXISTS email_settings;
