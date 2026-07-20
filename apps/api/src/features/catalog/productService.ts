import type {
  ProductComparisonResponse,
  ProductFilterOptionsResponse,
  ProductQuery,
} from '@shop/contracts/products';
import type {
  CustomerProductRow,
  ProductList,
  ProductRepository,
  VariantRow,
} from './productRepository.js';
import { buildComparisonItems, parseComparisonIds } from './productComparison.js';
import { rankSimilarProducts } from './productSimilarity.js';

export interface ProductService {
  list(query: ProductQuery): ProductList;
  listFilterOptions(): ProductFilterOptionsResponse;
  findById(id: number): CustomerProductRow | undefined;
  findCustomerProductById(id: number): CustomerProductRow | undefined;
  listVariants(productId: number): VariantRow[];
  listCategories(): string[];
  listBestsellers(limit?: number): CustomerProductRow[];
  compare(rawIds: string): ProductComparisonResponse;
  listSimilar(productId: number): CustomerProductRow[] | undefined;
  listRelated(productId: number): CustomerProductRow[] | undefined;
}

export interface ProductReadDependencies {
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
    findCustomerProductById: (id) => repository.findActiveById(id, now()),
    listVariants: (productId) => repository.findAllVariants(productId),
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
