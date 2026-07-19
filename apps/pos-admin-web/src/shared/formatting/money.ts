/** Display-only MYR formatting. Authoritative amounts remain server-side. */
export function formatRmFromSen(sen: number): string {
  const value = (Number.isFinite(sen) ? sen : 0) / 100;
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatRm(amount: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
