-- +goose Up
INSERT INTO email_templates (code, name, subject_i18n, body_html_i18n)
VALUES (
    'order_confirmation',
    'Order Confirmation',
    jsonb_build_object(
        'en', 'Order {{.OrderNumber}} confirmed',
        'lt', 'Užsakymas {{.OrderNumber}} patvirtintas'
    ),
    jsonb_build_object(
        'en', $$<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Inter',system-ui,-apple-system,sans-serif;color:#111827;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,.10);">

  <!-- Header -->
  <tr>
    <td style="padding:36px 40px 28px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);text-align:center;">
      <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,.12);border-radius:16px;line-height:56px;font-size:28px;margin-bottom:16px;">✓</div>
      <h1 style="margin:0;font-size:26px;font-weight:700;color:#f8fafc;letter-spacing:-0.3px;">Order Confirmed</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#94a3b8;">Thank you for your purchase</p>
    </td>
  </tr>

  <!-- Order info card -->
  <tr>
    <td style="padding:28px 40px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Order Number</td>
                <td style="text-align:right;font-size:15px;font-weight:700;color:#0f172a;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;">{{.OrderNumber}}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Total</td>
                <td style="text-align:right;font-size:22px;font-weight:800;color:#0f172a;">{{.Total}} {{.Currency}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  {{if .IsBankTransfer}}
  <!-- Bank transfer section -->
  <tr>
    <td style="padding:24px 40px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:2px solid #f59e0b;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;background:linear-gradient(135deg,#fffbeb,#fef3c7);">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#92400e;">⚡ Action Required</td>
              </tr>
              <tr>
                <td style="padding-top:6px;font-size:17px;font-weight:700;color:#78350f;">Complete your bank transfer</td>
              </tr>
              {{if .PaymentInstructions}}<tr>
                <td style="padding-top:8px;font-size:13px;line-height:1.5;color:#92400e;">{{.PaymentInstructions}}</td>
              </tr>{{end}}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;">
              {{if .BankAccountName}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;width:40%;">Account holder</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;">{{.BankAccountName}}</td>
              </tr>{{end}}
              {{if .BankName}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">Bank</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;">{{.BankName}}</td>
              </tr>{{end}}
              {{if .BankIBAN}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">IBAN</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:700;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;letter-spacing:0.5px;">{{.BankIBAN}}</td>
              </tr>{{end}}
              {{if .BankAccountNumber}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">Account number</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;">{{.BankAccountNumber}}</td>
              </tr>{{end}}
              {{if .BankBIC}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">BIC / SWIFT</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;">{{.BankBIC}}</td>
              </tr>{{end}}
              {{if .BankSortCode}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">Sort code</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;">{{.BankSortCode}}</td>
              </tr>{{end}}
              <tr>
                <td style="padding:16px 24px;background:#eff6ff;color:#1e40af;font-weight:600;" colspan="2">
                  Payment reference: <span style="font-family:'SF Mono',SFMono-Regular,Consolas,monospace;font-weight:800;font-size:15px;">{{.OrderNumber}}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px;background:#f0fdf4;color:#166534;font-weight:700;font-size:16px;" colspan="2">
                  Amount: {{.Total}} {{.Currency}}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  {{end}}

  <!-- Footer -->
  <tr>
    <td style="padding:28px 40px 36px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;text-align:center;">
        If you have questions about your order, reply to this email and include your order number.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>$$,
        'lt', $$<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Inter',system-ui,-apple-system,sans-serif;color:#111827;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,.10);">

  <!-- Header -->
  <tr>
    <td style="padding:36px 40px 28px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);text-align:center;">
      <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,.12);border-radius:16px;line-height:56px;font-size:28px;margin-bottom:16px;">✓</div>
      <h1 style="margin:0;font-size:26px;font-weight:700;color:#f8fafc;letter-spacing:-0.3px;">Užsakymas patvirtintas</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#94a3b8;">Ačiū už jūsų pirkinį</p>
    </td>
  </tr>

  <!-- Order info card -->
  <tr>
    <td style="padding:28px 40px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Užsakymo numeris</td>
                <td style="text-align:right;font-size:15px;font-weight:700;color:#0f172a;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;">{{.OrderNumber}}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Suma</td>
                <td style="text-align:right;font-size:22px;font-weight:800;color:#0f172a;">{{.Total}} {{.Currency}}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  {{if .IsBankTransfer}}
  <!-- Bank transfer section -->
  <tr>
    <td style="padding:24px 40px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:2px solid #f59e0b;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;background:linear-gradient(135deg,#fffbeb,#fef3c7);">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#92400e;">⚡ Reikalingas veiksmas</td>
              </tr>
              <tr>
                <td style="padding-top:6px;font-size:17px;font-weight:700;color:#78350f;">Atlikite banko pavedimą</td>
              </tr>
              {{if .PaymentInstructions}}<tr>
                <td style="padding-top:8px;font-size:13px;line-height:1.5;color:#92400e;">{{.PaymentInstructions}}</td>
              </tr>{{end}}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0;background:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;">
              {{if .BankAccountName}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;width:40%;">Gavėjas</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;">{{.BankAccountName}}</td>
              </tr>{{end}}
              {{if .BankName}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">Bankas</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;">{{.BankName}}</td>
              </tr>{{end}}
              {{if .BankIBAN}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">IBAN</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:700;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;letter-spacing:0.5px;">{{.BankIBAN}}</td>
              </tr>{{end}}
              {{if .BankAccountNumber}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">Sąskaitos numeris</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;">{{.BankAccountNumber}}</td>
              </tr>{{end}}
              {{if .BankBIC}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">BIC / SWIFT</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;">{{.BankBIC}}</td>
              </tr>{{end}}
              {{if .BankSortCode}}<tr>
                <td style="padding:14px 24px;color:#64748b;border-bottom:1px solid #f1f5f9;">Banko kodas</td>
                <td style="padding:14px 24px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;">{{.BankSortCode}}</td>
              </tr>{{end}}
              <tr>
                <td style="padding:16px 24px;background:#eff6ff;color:#1e40af;font-weight:600;" colspan="2">
                  Mokėjimo paskirtis: <span style="font-family:'SF Mono',SFMono-Regular,Consolas,monospace;font-weight:800;font-size:15px;">{{.OrderNumber}}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px;background:#f0fdf4;color:#166534;font-weight:700;font-size:16px;" colspan="2">
                  Suma: {{.Total}} {{.Currency}}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  {{end}}

  <!-- Footer -->
  <tr>
    <td style="padding:28px 40px 36px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;text-align:center;">
        Jei turite klausimų dėl užsakymo, atsakykite į šį laišką ir nurodykite užsakymo numerį.
      </p>
    </td>
  </tr>

</table>
</td></tr>
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
-- no-op (template was already missing before this migration)
