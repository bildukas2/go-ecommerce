-- +goose Up
INSERT INTO email_templates (code, name, subject_i18n, body_html_i18n)
VALUES (
    'test',
    'Test Email',
    '{"en":"Test email from your store","lt":"Bandomasis laiskas is jusu parduotuves"}'::jsonb,
    jsonb_build_object(
        'en', $$<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.06);">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#0f172a,#1f2937);color:#f9fafb;text-align:center;">
                <div style="font-size:11px;opacity:.7;letter-spacing:.1em;text-transform:uppercase;">Test Email</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">Your email is working!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;text-align:center;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
                  This is a test email sent from <strong>{{.StoreName}}</strong>.
                  If you received this, your email settings are configured correctly.
                </p>
                <div style="margin:20px 0;padding:14px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;display:inline-block;">
                  <span style="font-size:14px;color:#166534;">All systems go</span>
                </div>
                <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
                  Sent at {{.SentAt}}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>$$,
        'lt', $$<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.06);">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#0f172a,#1f2937);color:#f9fafb;text-align:center;">
                <div style="font-size:11px;opacity:.7;letter-spacing:.1em;text-transform:uppercase;">Bandomasis laiskas</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">Jusu el. pastas veikia!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;text-align:center;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
                  Tai bandomasis laiskas issiustas is <strong>{{.StoreName}}</strong>.
                  Jei gavote si laiska, jusu el. pasto nustatymai sukonfiguruoti teisingai.
                </p>
                <div style="margin:20px 0;padding:14px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;display:inline-block;">
                  <span style="font-size:14px;color:#166534;">Viskas veikia</span>
                </div>
                <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
                  Issiusta {{.SentAt}}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>$$
    )
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    subject_i18n = EXCLUDED.subject_i18n,
    body_html_i18n = EXCLUDED.body_html_i18n,
    updated_at = now();

-- +goose Down
DELETE FROM email_templates WHERE code = 'test';
