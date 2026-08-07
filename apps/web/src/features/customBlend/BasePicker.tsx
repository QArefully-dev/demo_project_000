import { useRef, useState } from 'react';
import { SACK_WEIGHT_GRAMS } from '@shop/contracts/pricing';
import type { CustomBlendOption } from '@shop/contracts/custom-blends';

import { getProduct } from '@/api/products';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PackagingArtwork } from '@/components/packaging/PackagingArtwork';
import { resolveCatalogPackagingPalette } from '@/components/packaging/catalogPackagingPalettes';
import { resolvePackagingSpec } from '@/components/packaging/packagingSpec';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { useLocalisation } from '@/i18n/LocaleContext';
import { customBlendMessages } from '@shop/localisation/messages/customBlend';

function findSackVariant(variants: { weightGrams: number; active: boolean; variantId: number }[]) {
  return variants.find((variant) => variant.active && variant.weightGrams === SACK_WEIGHT_GRAMS);
}

function optionPackagingProduct(option: CustomBlendOption) {
  return {
    id: option.productId,
    name: option.productName,
    category: option.category,
    consumptionClassification: option.consumptionClassification,
    categoryFacts: option.categoryFacts,
    mixingGroup: option.mixingGroup,
  };
}

/** Compact, option-backed confirmation of the URL-selected base material. */
export function SelectedBaseChip({
  base,
  onChange,
}: {
  base: CustomBlendOption;
  onChange: () => void;
}) {
  const { translate } = useLocalisation();
  const product = optionPackagingProduct(base);
  const hasArtwork = resolveCatalogPackagingPalette(product) !== undefined;

  return (
    <div className="custom-blend-tile mt-3 flex items-center gap-3 rounded-lg p-2.5">
      {hasArtwork ? (
        <PackagingArtwork
          name={base.productName}
          spec={resolvePackagingSpec({ product, variant: base.variant })}
          mark="CB"
          consumptionLabel={base.consumptionClassification}
          ariaLabel={`${base.productName} ${translate(customBlendMessages, 'customBlend.packaging')}`}
          className="h-14 w-14 shrink-0"
        />
      ) : (
        <div
          aria-label={`${base.productName} ${translate(customBlendMessages, 'customBlend.packagingUnavailableAria')}`}
          className="grid h-14 w-14 shrink-0 place-items-center rounded border bg-muted px-1 text-center text-[10px] text-muted-foreground"
        >
          {translate(customBlendMessages, 'customBlend.packagingUnavailable')}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{base.productName}</p>
        <p className="text-xs text-muted-foreground">{base.variant.label}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onChange}>
        {translate(customBlendMessages, 'customBlend.changeBase')}
      </Button>
    </div>
  );
}

export function BasePicker({ onSelectBase }: { onSelectBase: (variantId: number) => void }) {
  const { translate } = useLocalisation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [resolvingProductId, setResolvingProductId] = useState<string | null>(null);
  const [resolveErrorProductIds, setResolveErrorProductIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const resolveRequestIdRef = useRef(0);
  const { categories } = useCategories();
  const { products, isLoading, error, refetch } = useProducts({
    ...(query ? { q: query } : {}),
    ...(category ? { category } : {}),
  });

  const selectBaseProduct = async (productId: string) => {
    const requestId = ++resolveRequestIdRef.current;
    const isCurrent = () => requestId === resolveRequestIdRef.current;
    setResolvingProductId(productId);
    setResolveErrorProductIds((productIds) => {
      const nextProductIds = new Set(productIds);
      nextProductIds.delete(productId);
      return nextProductIds;
    });
    try {
      const detail = await getProduct(productId);
      if (!isCurrent()) return;
      const sackVariant = findSackVariant(detail.variants);
      if (!sackVariant) {
        setResolveErrorProductIds((productIds) => new Set(productIds).add(productId));
        return;
      }
      onSelectBase(sackVariant.variantId);
    } catch {
      if (!isCurrent()) return;
      setResolveErrorProductIds((productIds) => new Set(productIds).add(productId));
    } finally {
      if (isCurrent()) setResolvingProductId(null);
    }
  };

  return (
    <section
      aria-labelledby="custom-blend-base-picker-heading"
      className="custom-blend-surface grid gap-4 rounded-xl p-5"
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {translate(customBlendMessages, 'customBlend.baseStep')}
        </p>
        <h2 id="custom-blend-base-picker-heading" className="text-xl font-semibold">
          {translate(customBlendMessages, 'customBlend.baseMaterial')}
        </h2>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-sm">
          {translate(customBlendMessages, 'customBlend.searchMaterials')}
          <input
            type="search"
            id="custom-blend-search"
            className="rounded-md border px-3 py-1.5 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          {translate(customBlendMessages, 'customBlend.category')}
          <select
            id="custom-blend-category"
            className="rounded-md border px-3 py-1.5 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{translate(customBlendMessages, 'customBlend.allCategories')}</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <ErrorMessage message={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div
          aria-live="polite"
          aria-label={translate(customBlendMessages, 'customBlend.loadingMaterials')}
          className="grid gap-3"
        >
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : products.length === 0 ? (
        <p aria-live="polite">{translate(customBlendMessages, 'customBlend.noMaterials')}</p>
      ) : (
        <ul
          className="grid gap-3 sm:grid-cols-2"
          aria-label={translate(customBlendMessages, 'customBlend.baseOptions')}
        >
          {products.map((product) => (
            <li
              key={product.id}
              className="custom-blend-tile grid grid-cols-[4.5rem_1fr] gap-3 rounded-xl p-3"
            >
              {resolveCatalogPackagingPalette(product) ? (
                <PackagingArtwork
                  name={product.name}
                  spec={resolvePackagingSpec({ product })}
                  mark="CB"
                  consumptionLabel={product.consumptionClassification ?? null}
                  ariaLabel={`${product.name} ${translate(customBlendMessages, 'customBlend.packaging')}`}
                  className="h-[4.5rem] w-[4.5rem]"
                />
              ) : (
                <div
                  aria-label={`${product.name} ${translate(customBlendMessages, 'customBlend.packagingUnavailableAria')}`}
                  className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded border bg-muted px-1 text-center text-[10px] text-muted-foreground"
                >
                  {translate(customBlendMessages, 'customBlend.packagingUnavailable')}
                </div>
              )}
              <div className="grid content-start gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{product.name}</span>
                  <Badge variant="secondary">{product.category}</Badge>
                </div>
                {product.mixingGroup && (
                  <span className="text-xs text-muted-foreground">
                    {translate(customBlendMessages, 'customBlend.mixingGroup', {
                      group: product.mixingGroup,
                    })}
                  </span>
                )}
                {resolveErrorProductIds.has(product.id) && (
                  <p role="alert" className="text-xs text-destructive">
                    {translate(customBlendMessages, 'customBlend.noSackVariant')}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  disabled={resolvingProductId === product.id}
                  onClick={() => void selectBaseProduct(product.id)}
                >
                  {translate(customBlendMessages, 'customBlend.useAsBase', { name: product.name })}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
