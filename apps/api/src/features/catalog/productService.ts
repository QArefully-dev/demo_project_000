import type {
  ProductComparisonResponse,
  ProductFilterOptionsResponse,
  ProductQuery,
} from '@shop/contracts/products';
import type { CustomerProductRow, ProductList, ProductRepository } from './productRepository.js';
import { buildComparisonItems, parseComparisonIds } from './productComparison.js';
import { rankSimilarProducts } from './productSimilarity.js';

export interface ProductService {
  list(query: ProductQuery): ProductList;
  listFilterOptions(): ProductFilterOptionsResponse;
  /** Customer-facing product detail lookup. */
  findById(id: number): CustomerProductRow | undefined;
  listCategories(): string[];
  listBestsellers(limit?: number): CustomerProductRow[];
  compare(rawIds: string): ProductComparisonResponse;
  /** Undefined when the source product is missing or inactive. */
  listSimilar(productId: number): CustomerProductRow[] | undefined;
  /** Compatibility alias for the deterministic similar-products result. */
  listRelated(productId: number): CustomerProductRow[] | undefined;
}

export interface ProductReadDependencies {
  /** Shared app clock; all customer availability reads use one injected instant. */
  clock: { now(): Date };
}

export function createProductService(
  repository: ProductRepository,
  dependencies: ProductReadDependencies = { clock: { now: () => new Date() } },
): ProductService {
  const now = (): string => dependencies.clock.now().toISOString();
  const listSimilar = (productId: number): CustomerProductRow[] | undefined => {
    const at = now();
    const source = repository.findActiveById(productId, at);
    if (!source) return undefined;
    return rankSimilarProducts(source, repository.listActiveCandidatesExcluding(source.id, at));
  };

  return {
    list: (query) => repository.list(query, now()),
    listFilterOptions: () => repository.listFilterOptions(),
    findById: (id) => repository.findActiveById(id, now()),
    listCategories: () => repository.listCategories(),
    listBestsellers: (limit) => repository.listBestsellers(limit, now()),
    compare: (rawIds) => {
      const requestedIds = parseComparisonIds(rawIds);
      return buildComparisonItems(requestedIds, repository.listByIds(requestedIds, now()));
    },
    listSimilar,
    listRelated: listSimilar,
  };
}
