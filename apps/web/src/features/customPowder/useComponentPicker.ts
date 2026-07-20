import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@shop/contracts/products';

const ALL_POWDERS = 'All powders';
export const COMPONENT_PICKER_PAGE_SIZE = 8;

function categoryForInitialSelection(
  products: readonly Product[],
  selectedProductIds: readonly string[],
): string {
  const selectedCategory = products.find((product) =>
    selectedProductIds.includes(product.id),
  )?.category;
  if (selectedCategory) return selectedCategory;
  return products.some(({ category }) => category === 'Pantry Staples')
    ? 'Pantry Staples'
    : (products[0]?.category ?? ALL_POWDERS);
}

export function useComponentPicker(
  products: readonly Product[],
  selectedProductIds: readonly string[],
) {
  const categories = useMemo(
    () => [ALL_POWDERS, ...Array.from(new Set(products.map(({ category }) => category)))],
    [products],
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const resolvedCategory =
    activeCategory ?? categoryForInitialSelection(products, selectedProductIds);

  useEffect(() => {
    if (!categories.includes(resolvedCategory)) {
      setActiveCategory(categoryForInitialSelection(products, selectedProductIds));
      setPage(1);
    }
  }, [categories, products, resolvedCategory, selectedProductIds]);

  const activeProducts = useMemo(
    () =>
      resolvedCategory === ALL_POWDERS
        ? [...products]
        : products.filter(({ category }) => category === resolvedCategory),
    [products, resolvedCategory],
  );
  const pageCount = Math.max(1, Math.ceil(activeProducts.length / COMPONENT_PICKER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleProducts = activeProducts.slice(
    (currentPage - 1) * COMPONENT_PICKER_PAGE_SIZE,
    currentPage * COMPONENT_PICKER_PAGE_SIZE,
  );

  return {
    categories,
    activeCategory: resolvedCategory,
    activeProducts,
    currentPage,
    pageCount,
    visibleProducts,
    selectCategory: (category: string) => {
      setActiveCategory(category);
      setPage(1);
    },
    selectPage: setPage,
  };
}
