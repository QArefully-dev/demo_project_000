const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Format integer cents to a USD currency string. Never used for computation. */
export function formatMoney(cents: number): string {
  return usdFormatter.format(cents / 100);
}
