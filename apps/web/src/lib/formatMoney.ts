/** Format integer cents to a USD currency string. Never used for computation. */
export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
