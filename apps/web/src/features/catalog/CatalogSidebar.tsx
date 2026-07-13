import { X } from 'lucide-react';

interface CatalogSidebarProps {
  categories: string[];
  category?: string;
  onSale?: boolean;
  query?: string;
  hasFilters: boolean;
  onCategoryChange: (category: string | undefined) => void;
  onSaleChange: (onSale: boolean) => void;
  onQueryClear: () => void;
  onClearFilters: () => void;
}

export function CatalogSidebar({
  categories,
  category,
  onSale,
  query,
  hasFilters,
  onCategoryChange,
  onSaleChange,
  onQueryClear,
  onClearFilters,
}: CatalogSidebarProps) {
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
        <legend className="mb-2 text-sm font-semibold">Department</legend>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
          <FilterButton active={!category} onClick={() => onCategoryChange(undefined)}>
            All departments
          </FilterButton>
          {categories.map((item) => (
            <FilterButton
              key={item}
              active={category === item}
              onClick={() => onCategoryChange(item)}
            >
              {item}
            </FilterButton>
          ))}
        </div>
      </fieldset>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background p-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={onSale === true}
          onChange={(event) => onSaleChange(event.target.checked)}
          className="size-4 accent-primary"
        />
        On sale now
      </label>
      {hasFilters && (
        <div className="flex flex-wrap gap-2" aria-label="Active filters">
          {query && <FilterChip onClick={onQueryClear}>{query}</FilterChip>}
          {category && (
            <FilterChip onClick={() => onCategoryChange(undefined)}>{category}</FilterChip>
          )}
          {onSale && <FilterChip onClick={() => onSaleChange(false)}>On sale</FilterChip>}
        </div>
      )}
    </aside>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:block lg:w-full ${active ? 'bg-accent font-semibold text-accent-foreground' : 'hover:bg-muted'}`}
    >
      {children}
    </button>
  );
}

function FilterChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <X className="size-3" aria-hidden="true" />
      <span className="sr-only">Remove filter</span>
    </button>
  );
}
