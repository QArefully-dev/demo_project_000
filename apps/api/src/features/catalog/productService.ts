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

export function createProductService(repository: ProductRepository): ProductService {
  const listSimilar = (productId: number): CustomerProductRow[] | undefined => {
    const source = repository.findActiveById(productId);
    if (!source) return undefined;
    return rankSimilarProducts(source, repository.listActiveCandidatesExcluding(source.id));
  };

  return {
    list: (query) => repository.list(query),
    listFilterOptions: () => repository.listFilterOptions(),
    findById: (id) => repository.findActiveById(id),
    listCategories: () => repository.listCategories(),
    listBestsellers: (limit) => repository.listBestsellers(limit),
    compare: (rawIds) => {
      const requestedIds = parseComparisonIds(rawIds);
      return buildComparisonItems(requestedIds, repository.listByIds(requestedIds));
    },
    listSimilar,
    listRelated: listSimilar,
  };
}
