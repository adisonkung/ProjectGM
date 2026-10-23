/** Display only: keep exact balances in saves and accessible labels. Never round up spending power. */
export function formatCurrency(value: number): string {
  if (value < 100_000) return value.toLocaleString('en-US');
  const [unit, suffix] = value >= 1_000_000_000 ? [1_000_000_000, 'b'] : value >= 1_000_000 ? [1_000_000, 'm'] : [1_000, 'k'];
  return (Math.floor(value / (unit / 10)) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 }) + suffix;
}
