-- +goose Up
INSERT INTO payment_methods (key, title, description, instructions, enabled, payment_type, config_json, sort_order)
VALUES (
  'bank-transfer',
  'Direct Bank Transfer',
  'Take payments in person via bank transfer. Commonly known as direct bank/wire transfer.',
  'Please send the payment to the bank account details provided after order confirmation.',
  true,
  'manual',
  '{"account_holder": "Your Store Name", "account_number": "", "bank_name": "", "sort_code": "", "iban": "", "bic_swift": ""}'::jsonb,
  10
)
ON CONFLICT (key) DO NOTHING;

-- +goose Down
DELETE FROM payment_methods WHERE key = 'bank-transfer';
