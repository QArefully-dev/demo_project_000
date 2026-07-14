import type { ProductQuery } from '@shop/contracts/products';

export const SORT_OPTIONS: { value: ProductQuery['sort']; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'bestselling', label: 'Best Selling' },
];

export const PAGE_SIZES = [12, 24, 48];
