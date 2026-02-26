-- +goose Up
UPDATE email_templates
SET
    subject_i18n = jsonb_build_object(
        'en', 'Order {{.OrderNumber}} confirmed',
        'lt', 'Uzsakymas {{.OrderNumber}} patvirtintas'
    ),
    body_html_i18n = jsonb_build_object(
        'en', $$<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1f2937);color:#f9fafb;">
                <div style="font-size:12px;opacity:.8;letter-spacing:.08em;text-transform:uppercase;">Order Confirmation</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Your order is confirmed</h1>
                <p style="margin:12px 0 0;font-size:15px;opacity:.9;">Order <strong>{{.OrderNumber}}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#6b7280;">Order number</td>
                    <td style="padding:14px 16px;font-size:14px;color:#111827;text-align:right;"><strong>{{.OrderNumber}}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Total</td>
                    <td style="padding:14px 16px;font-size:16px;color:#111827;text-align:right;border-top:1px solid #e5e7eb;"><strong>{{.Total}} {{.Currency}}</strong></td>
                  </tr>
                </table>

                {{if .IsBankTransfer}}
                <div style="margin-top:20px;padding:18px;border:1px solid #fde68a;background:#fffbeb;border-radius:14px;">
                  <h2 style="margin:0 0 8px;font-size:18px;color:#92400e;">Bank transfer instructions</h2>
                  {{if .PaymentInstructions}}<p style="margin:0 0 12px;font-size:14px;color:#7c2d12;">{{.PaymentInstructions}}</p>{{end}}
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;">
                    {{if .PaymentTitle}}<tr><td style="padding:4px 0;color:#6b7280;">Method</td><td style="padding:4px 0;text-align:right;color:#111827;"><strong>{{.PaymentTitle}}</strong></td></tr>{{end}}
                    {{if .BankAccountName}}<tr><td style="padding:4px 0;color:#6b7280;">Account name</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankAccountName}}</td></tr>{{end}}
                    {{if .BankName}}<tr><td style="padding:4px 0;color:#6b7280;">Bank</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankName}}</td></tr>{{end}}
                    {{if .BankAccountNumber}}<tr><td style="padding:4px 0;color:#6b7280;">Account number</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankAccountNumber}}</td></tr>{{end}}
                    {{if .BankIBAN}}<tr><td style="padding:4px 0;color:#6b7280;">IBAN</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankIBAN}}</td></tr>{{end}}
                    {{if .BankBIC}}<tr><td style="padding:4px 0;color:#6b7280;">BIC/SWIFT</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankBIC}}</td></tr>{{end}}
                    {{if .BankSortCode}}<tr><td style="padding:4px 0;color:#6b7280;">Sort code</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankSortCode}}</td></tr>{{end}}
                  </table>
                </div>
                {{end}}

                <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  If you have questions about your order, reply to this email and include your order number.
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
          <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">
            <tr>
              <td style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1f2937);color:#f9fafb;">
                <div style="font-size:12px;opacity:.8;letter-spacing:.08em;text-transform:uppercase;">Uzsakymo patvirtinimas</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Jusu uzsakymas patvirtintas</h1>
                <p style="margin:12px 0 0;font-size:15px;opacity:.9;">Uzsakymas <strong>{{.OrderNumber}}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#6b7280;">Uzsakymo numeris</td>
                    <td style="padding:14px 16px;font-size:14px;color:#111827;text-align:right;"><strong>{{.OrderNumber}}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;">Suma</td>
                    <td style="padding:14px 16px;font-size:16px;color:#111827;text-align:right;border-top:1px solid #e5e7eb;"><strong>{{.Total}} {{.Currency}}</strong></td>
                  </tr>
                </table>

                {{if .IsBankTransfer}}
                <div style="margin-top:20px;padding:18px;border:1px solid #fde68a;background:#fffbeb;border-radius:14px;">
                  <h2 style="margin:0 0 8px;font-size:18px;color:#92400e;">Mokejimo banko pavedimu instrukcija</h2>
                  {{if .PaymentInstructions}}<p style="margin:0 0 12px;font-size:14px;color:#7c2d12;">{{.PaymentInstructions}}</p>{{end}}
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;">
                    {{if .PaymentTitle}}<tr><td style="padding:4px 0;color:#6b7280;">Metodas</td><td style="padding:4px 0;text-align:right;color:#111827;"><strong>{{.PaymentTitle}}</strong></td></tr>{{end}}
                    {{if .BankAccountName}}<tr><td style="padding:4px 0;color:#6b7280;">Gavejas</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankAccountName}}</td></tr>{{end}}
                    {{if .BankName}}<tr><td style="padding:4px 0;color:#6b7280;">Bankas</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankName}}</td></tr>{{end}}
                    {{if .BankAccountNumber}}<tr><td style="padding:4px 0;color:#6b7280;">Saskaitos numeris</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankAccountNumber}}</td></tr>{{end}}
                    {{if .BankIBAN}}<tr><td style="padding:4px 0;color:#6b7280;">IBAN</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankIBAN}}</td></tr>{{end}}
                    {{if .BankBIC}}<tr><td style="padding:4px 0;color:#6b7280;">BIC/SWIFT</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankBIC}}</td></tr>{{end}}
                    {{if .BankSortCode}}<tr><td style="padding:4px 0;color:#6b7280;">Banko kodas</td><td style="padding:4px 0;text-align:right;color:#111827;">{{.BankSortCode}}</td></tr>{{end}}
                  </table>
                </div>
                {{end}}

                <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  Jei turite klausimu del uzsakymo, atsakykite i si laiska ir nurodykite uzsakymo numeri.
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
WHERE code = 'order_confirmation';

-- +goose Down
UPDATE email_templates
SET
    subject_i18n = '{"en":"Your order {{.OrderNumber}} is confirmed","lt":"Jusu uzsakymas {{.OrderNumber}} patvirtintas"}'::jsonb,
    body_html_i18n = '{"en":"<h1>Thank you for your order!</h1><p>Order: {{.OrderNumber}}</p>","lt":"<h1>Aciu uz uzsakyma!</h1><p>Uzsakymas: {{.OrderNumber}}</p>"}'::jsonb,
    updated_at = now()
WHERE code = 'order_confirmation';
