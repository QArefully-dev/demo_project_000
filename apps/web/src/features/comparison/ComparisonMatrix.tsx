import { Link } from 'react-router-dom';
import type { Product, ProductSpecification, PriceRange } from '@shop/contracts/products';
import { ProductMedia } from '@/components/ProductMedia';
import { formatMoney } from '@/lib/formatMoney';

interface MatrixProduct extends Product {
  priceRange?: PriceRange;
  baseAvailability?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder';
  variants?: unknown[];
}

interface ComparisonMatrixProps {
  products: readonly MatrixProduct[];
  onRemove: (productId: string) => void;
}

interface MatrixRow {
  key: string;
  groupLabel: string;
  groupOrder: number;
  specificationLabel: string;
  specificationPosition: number;
  values: readonly (ProductSpecification | undefined)[];
  differs: boolean;
}

const MISSING_VALUE = '__not_specified__';

function buildRows(products: readonly MatrixProduct[]): MatrixRow[] {
  const rows = new Map<
    string,
    Omit<MatrixRow, 'values' | 'differs'> & { values: (ProductSpecification | undefined)[] }
  >();

  products.forEach((product, productIndex) => {
    product.specificationGroups.forEach((group) => {
      group.specifications.forEach((specification, specificationPosition) => {
        const rowKey = `${group.key}:${specification.key}`;
        const existing = rows.get(rowKey);
        if (existing) {
          existing.values[productIndex] = specification;
          return;
        }
        const values = Array<ProductSpecification | undefined>(products.length).fill(undefined);
        values[productIndex] = specification;
        rows.set(rowKey, {
          key: rowKey,
          groupLabel: group.label,
          groupOrder: group.order,
          specificationLabel: specification.label,
          specificationPosition,
          values,
        });
      });
    });
  });

  return [...rows.values()]
    .map((row) => ({
      ...row,
      differs: new Set(row.values.map((value) => value?.valueKey ?? MISSING_VALUE)).size > 1,
    }))
    .sort(
      (left, right) =>
        Number(right.differs) - Number(left.differs) ||
        left.groupOrder - right.groupOrder ||
        left.specificationPosition - right.specificationPosition ||
        left.key.localeCompare(right.key),
    );
}

function priceLabel(p: MatrixProduct): string {
  if (p.priceRange) {
    if (p.priceRange.min !== p.priceRange.max) {
      return `From ${formatMoney(p.priceRange.min)}`;
    }
    return formatMoney(p.priceRange.min);
  }
  return formatMoney(p.priceCents);
}

function availabilityLabel(p: MatrixProduct): string {
  const base = p.baseAvailability;
  if (base === 'in_stock' || base === 'low_stock') return 'Available';
  if (base === 'backorder') return 'Backorder';
  if (base === 'out_of_stock') return 'Out of stock';
  return p.available ? 'Available' : 'Out of stock';
}

export function ComparisonMatrix({ products, onRemove }: ComparisonMatrixProps) {
  const rows = buildRows(products);

  return (
    <div className="overflow-x-auto rounded-2xl border bg-surface-raised focus-within:ring-2 focus-within:ring-ring">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="p-5 text-left text-base font-semibold">
          Product specifications comparison
        </caption>
        <thead className="border-y bg-surface-soft align-top">
          <tr>
            <th scope="col" className="min-w-44 p-4 font-semibold">
              Specification
            </th>
            {products.map((product) => (
              <th key={product.id} scope="col" className="min-w-56 p-4 font-normal">
                <div className="space-y-3">
                  <ProductMedia
                    product={product}
                    className="h-36 w-full rounded-lg object-contain"
                  />
                  <Link
                    to={`/products/${product.id}`}
                    className="block rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {product.name}
                  </Link>
                  <dl className="space-y-1 text-xs text-muted-foreground">
                    <div>
                      <dt className="sr-only">Price</dt>
                      <dd>{priceLabel(product)}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Category</dt>
                      <dd>{product.category}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Availability</dt>
                      <dd>{availabilityLabel(product)}</dd>
                    </div>
                    {product.consumptionClassification && (
                      <div>
                        <dt className="sr-only">Classification</dt>
                        <dd>{product.consumptionClassification}</dd>
                      </div>
                    )}
                  </dl>
                  <button
                    type="button"
                    onClick={() => onRemove(product.id)}
                    className="rounded-sm text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Remove {product.name}
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.differs ? 'bg-primary/5' : 'border-t'}>
              <th scope="row" className="border-t p-4 font-medium">
                <span className="block text-xs font-normal text-muted-foreground">
                  {row.groupLabel}
                </span>
                {row.specificationLabel}
              </th>
              {row.values.map((value, index) => (
                <td
                  key={`${row.key}:${products[index]!.id}`}
                  className="border-t p-4 text-muted-foreground"
                >
                  {value?.value ?? 'Not specified'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
