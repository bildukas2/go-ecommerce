export function formatMoney(amountMinor: number, currency = "EUR") {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
