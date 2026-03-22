-- +goose Up
UPDATE email_templates
SET
    subject_i18n = jsonb_build_object(
        'en', 'Reset your password',
        'lt', 'Slaptažodžio atstatymas'
    ),
    body_html_i18n = jsonb_build_object(
        'en', $$<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.06);">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#0f172a,#1f2937);color:#f9fafb;text-align:center;">
                <div style="font-size:11px;opacity:.7;letter-spacing:.1em;text-transform:uppercase;">Password Reset</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;text-align:center;">
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
                  We received a request to reset the password for your account. Click the button below to set a new password.
                </p>
                <a href="{{.ResetURL}}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                  Reset Password
                </a>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#9ca3af;">
                  This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.
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
                <div style="font-size:11px;opacity:.7;letter-spacing:.1em;text-transform:uppercase;">Slaptažodžio atstatymas</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">Atstatykite savo slaptažodį</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;text-align:center;">
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
                  Gavome prašymą atstatyti jūsų paskyros slaptažodį. Paspauskite žemiau esantį mygtuką, kad nustatytumėte naują slaptažodį.
                </p>
                <a href="{{.ResetURL}}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                  Atstatyti slaptažodį
                </a>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#9ca3af;">
                  Ši nuoroda galios 1 valandą. Jei jūs neprašėte slaptažodžio atstatymo, galite tiesiog ignoruoti šį laišką.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>$$
    ),
    updated_at = now()
WHERE code = 'password_reset';

-- +goose Down
UPDATE email_templates
SET
    subject_i18n = '{"en":"Reset your password","lt":"Atstatyti slaptazodi"}'::jsonb,
    body_html_i18n = '{"en":"<h1>Reset Password</h1><p><a href=\"{{.ResetURL}}\">Click here</a></p>","lt":"<h1>Atstatyti slaptazodi</h1><p><a href=\"{{.ResetURL}}\">Spauskite cia</a></p>"}'::jsonb,
    updated_at = now()
WHERE code = 'password_reset';
