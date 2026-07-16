import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ProductFilterOptionsResponse, ProductQuery } from '@shop/contracts/products';

type Availability = NonNullable<ProductQuery['availability']>;

interface CatalogSidebarProps {
  categories: string[];
  category?: string;
  onSale?: boolean;
  query?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  addedFrom?: string;
  addedTo?: string;
  availability?: Availability;
  tags?: readonly string[];
  specs?: readonly string[];
  filterOptions?: ProductFilterOptionsResponse;
  filterOptionsLoading?: boolean;
  filterOptionsError?: string;
  hasFilters: boolean;
  onCategoryChange: (category: string | undefined) => void;
  onSaleChange: (onSale: boolean) => void;
  onQueryClear: () => void;
  onPriceRangeChange: (min: number | undefined, max: number | undefined) => void;
  onDateRangeChange: (from: string | undefined, to: string | undefined) => void;
  onAvailabilityChange: (value: Availability | undefined) => void;
  onTagChange: (tag: string, selected: boolean) => void;
  onSpecChange: (specificationKey: string, valueKey: string | undefined) => void;
  onClearFilters: () => void;
}

export function CatalogSidebar({
  categories,
  category,
  onSale,
  query,
  minPriceCents,
  maxPriceCents,
  addedFrom,
  addedTo,
  availability,
  tags = [],
  specs = [],
  filterOptions,
  filterOptionsLoading = false,
  filterOptionsError,
  hasFilters,
  onCategoryChange,
  onSaleChange,
  onQueryClear,
  onPriceRangeChange,
  onDateRangeChange,
  onAvailabilityChange,
  onTagChange,
  onSpecChange,
  onClearFilters,
}: CatalogSidebarProps) {
  const [minPriceDraft, setMinPriceDraft] = useState(minPriceCents?.toString() ?? '');
  const [maxPriceDraft, setMaxPriceDraft] = useState(maxPriceCents?.toString() ?? '');
  const [addedFromDraft, setAddedFromDraft] = useState(addedFrom ?? '');
  const [addedToDraft, setAddedToDraft] = useState(addedTo ?? '');

  useEffect(() => setMinPriceDraft(minPriceCents?.toString() ?? ''), [minPriceCents]);
  useEffect(() => setMaxPriceDraft(maxPriceCents?.toString() ?? ''), [maxPriceCents]);
  useEffect(() => setAddedFromDraft(addedFrom ?? ''), [addedFrom]);
  useEffect(() => setAddedToDraft(addedTo ?? ''), [addedTo]);

  const commitPriceRange = (minDraft: string, maxDraft: string) => {
    const min = readNonNegativeInteger(minDraft);
    const max = readNonNegativeInteger(maxDraft);
    if (
      (minDraft === '' || min !== undefined) &&
      (maxDraft === '' || max !== undefined) &&
      (min === undefined || max === undefined || min <= max)
    ) {
      onPriceRangeChange(min, max);
    }
  };
  const commitDateRange = (fromDraft: string, toDraft: string) => {
    const from = fromDraft || undefined;
    const to = toDraft || undefined;
    if (!from || !to || from <= to) onDateRangeChange(from, to);
  };
  const tagByKey = new Map(filterOptions?.tags.map((tag) => [tag.key, tag]));
  const selectedSpecs = new Map(
    specs.map((token) => {
      const [key, value] = token.split(':', 2);
      return [key, value] as const;
    }),
  );
  const knownSpecificationTokens = new Set(
    (filterOptions?.specificationGroups ?? []).flatMap((group) =>
      group.specifications.flatMap((specification) =>
        specification.values.map((value) => `${specification.key}:${value.key}`),
      ),
    ),
  );

  return (
    <aside
      aria-label="Catalog filters"
      className="space-y-5 rounded-2xl border border-border/80 bg-surface-raised p-4 lg:sticky lg:top-32 lg:self-start"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Filters</h2>
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-sm text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear all
          </button>
        )}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Powder type</legend>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
          <CategoryChoice
            checked={!category}
            name="catalog-category"
            onChange={() => onCategoryChange(undefined)}
          >
            All powders
          </CategoryChoice>
          {categories.map((item) => (
            <CategoryChoice
              key={item}
              checked={category === item}
              name="catalog-category"
              onChange={() => onCategoryChange(item)}
            >
              {item}
            </CategoryChoice>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Offers</legend>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background p-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={onSale === true}
            onChange={(event) => onSaleChange(event.target.checked)}
            className="size-4 accent-primary"
          />
          On sale now
        </label>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Price</legend>
        <div className="grid grid-cols-2 gap-2">
          <label
            className="grid gap-1 text-xs font-medium text-muted-foreground"
            htmlFor="catalog-min-price"
          >
            Minimum (cents)
            <input
              id="catalog-min-price"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={minPriceDraft}
              onChange={(event) => {
                const value = event.target.value;
                setMinPriceDraft(value);
                commitPriceRange(value, maxPriceDraft);
              }}
              className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label
            className="grid gap-1 text-xs font-medium text-muted-foreground"
            htmlFor="catalog-max-price"
          >
            Maximum (cents)
            <input
              id="catalog-max-price"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={maxPriceDraft}
              onChange={(event) => {
                const value = event.target.value;
                setMaxPriceDraft(value);
                commitPriceRange(minPriceDraft, value);
              }}
              className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Date added</legend>
        <div className="grid gap-2">
          <label
            className="grid gap-1 text-xs font-medium text-muted-foreground"
            htmlFor="catalog-added-from"
          >
            From
            <input
              id="catalog-added-from"
              type="date"
              value={addedFromDraft}
              onChange={(event) => {
                const value = event.target.value;
                setAddedFromDraft(value);
                commitDateRange(value, addedToDraft);
              }}
              className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label
            className="grid gap-1 text-xs font-medium text-muted-foreground"
            htmlFor="catalog-added-to"
          >
            To
            <input
              id="catalog-added-to"
              type="date"
              value={addedToDraft}
              onChange={(event) => {
                const value = event.target.value;
                setAddedToDraft(value);
                commitDateRange(addedFromDraft, value);
              }}
              className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Availability</legend>
        <div className="grid gap-2">
          <AvailabilityChoice
            checked={!availability}
            label="All availability"
            onChange={() => onAvailabilityChange(undefined)}
          />
          <AvailabilityChoice
            checked={availability === 'available'}
            label="In stock"
            value="available"
            onChange={() => onAvailabilityChange('available')}
          />
          <AvailabilityChoice
            checked={availability === 'out_of_stock'}
            label="Out of stock"
            value="out_of_stock"
            onChange={() => onAvailabilityChange('out_of_stock')}
          />
        </div>
      </fieldset>
      {filterOptionsLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading more filters…
        </p>
      ) : filterOptionsError ? (
        <p className="text-sm text-muted-foreground" role="status">
          More filters are unavailable.
        </p>
      ) : filterOptions ? (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Tags</legend>
            <div className="grid gap-2">
              {filterOptions.tags.map((tag) => (
                <label key={tag.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={tags.includes(tag.key)}
                    onChange={(event) => onTagChange(tag.key, event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  {tag.label}
                </label>
              ))}
            </div>
          </fieldset>
          {filterOptions.specificationGroups.map((group) => (
            <fieldset key={group.key}>
              <legend className="mb-2 text-sm font-semibold">{group.label}</legend>
              <div className="grid gap-3">
                {group.specifications.map((specification) => (
                  <label
                    key={specification.key}
                    className="grid gap-1 text-sm font-medium"
                    htmlFor={`catalog-spec-${specification.key}`}
                  >
                    {specification.label}
                    <select
                      id={`catalog-spec-${specification.key}`}
                      value={selectedSpecs.get(specification.key) ?? ''}
                      onChange={(event) =>
                        onSpecChange(specification.key, event.target.value || undefined)
                      }
                      className="h-10 rounded-lg border bg-background px-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Any {specification.label.toLowerCase()}</option>
                      {specification.values.map((value) => (
                        <option key={value.key} value={value.key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </>
      ) : null}
      {hasFilters && (
        <div className="flex flex-wrap gap-2" aria-label="Active filters">
          {query && <FilterChip label={`Search: ${query}`} onClick={onQueryClear} />}
          {category && (
            <FilterChip label={`Type: ${category}`} onClick={() => onCategoryChange(undefined)} />
          )}
          {onSale && <FilterChip label="On sale" onClick={() => onSaleChange(false)} />}
          {minPriceCents !== undefined && (
            <FilterChip
              label={`Minimum price: ${minPriceCents} cents`}
              onClick={() => onPriceRangeChange(undefined, maxPriceCents)}
            />
          )}
          {maxPriceCents !== undefined && (
            <FilterChip
              label={`Maximum price: ${maxPriceCents} cents`}
              onClick={() => onPriceRangeChange(minPriceCents, undefined)}
            />
          )}
          {addedFrom && (
            <FilterChip
              label={`Added from: ${addedFrom}`}
              onClick={() => onDateRangeChange(undefined, addedTo)}
            />
          )}
          {addedTo && (
            <FilterChip label={`Added to: ${addedTo}`} onClick={() => onDateRangeChange(addedFrom, undefined)} />
          )}
          {availability && (
            <FilterChip
              label={availability === 'available' ? 'In stock' : 'Out of stock'}
              onClick={() => onAvailabilityChange(undefined)}
            />
          )}
          {tags.flatMap((tagKey) => {
            const tag = tagByKey.get(tagKey);
            return tag
              ? [
                  <FilterChip
                    key={tag.key}
                    label={`Tag: ${tag.label}`}
                    onClick={() => onTagChange(tag.key, false)}
                  />,
                ]
              : [
                  <FilterChip
                    key={tagKey}
                    label={`Tag: ${tagKey}`}
                    onClick={() => onTagChange(tagKey, false)}
                  />,
                ];
          })}
          {filterOptions?.specificationGroups.flatMap((group) =>
            group.specifications.flatMap((specification) => {
              const valueKey = selectedSpecs.get(specification.key);
              const value = specification.values.find((option) => option.key === valueKey);
              return value
                ? [
                    <FilterChip
                      key={`${specification.key}:${value.key}`}
                      label={`${specification.label}: ${value.label}`}
                      onClick={() => onSpecChange(specification.key, undefined)}
                    />,
                  ]
                : [];
            }),
          )}
          {specs
            .filter((token) => !knownSpecificationTokens.has(token))
            .map((token) => {
              const key = token.slice(0, token.indexOf(':'));
              return (
                <FilterChip
                  key={token}
                  label={`Specification: ${token}`}
                  onClick={() => onSpecChange(key, undefined)}
                />
              );
            })}
        </div>
      )}
    </aside>
  );
}

function CategoryChoice({
  checked,
  name,
  onChange,
  children,
}: {
  checked: boolean;
  name: string;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${checked ? 'bg-accent font-semibold text-accent-foreground' : 'hover:bg-muted'}`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-4 accent-primary"
      />
      {children}
    </label>
  );
}

function AvailabilityChoice({
  checked,
  label,
  value,
  onChange,
}: {
  checked: boolean;
  label: string;
  value?: Availability;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="radio"
        name="catalog-availability"
        value={value ?? ''}
        checked={checked}
        onChange={onChange}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}

function FilterChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove ${label} filter`}
      className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
      <X className="size-3" aria-hidden="true" />
      <span className="sr-only">Remove {label} filter</span>
    </button>
  );
}

function readNonNegativeInteger(value: string): number | undefined {
  if (value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
