import type { ProductFilterOptionsResponse, ProductQuery } from '@shop/contracts/products';
import type { ProductList, ProductRepository, ProductRow } from './productRepository.js';

export interface ProductService {
  list(query: ProductQuery): ProductList;
  listFilterOptions(): ProductFilterOptionsResponse;
  /** Customer-facing product detail lookup. */
  findById(id: number): ProductRow | undefined;
  listCategories(): string[];
  listBestsellers(limit?: number): ProductRow[];
  listRelated(productId: number, limit?: number): ProductRow[];
}

export function createProductService(repository: ProductRepository): ProductService {
  return {
    list: (query) => repository.list(query),
    listFilterOptions: () => repository.listFilterOptions(),
    findById: (id) => repository.findActiveById(id),
    listCategories: () => repository.listCategories(),
    listBestsellers: (limit) => repository.listBestsellers(limit),
    listRelated: (productId, limit) => repository.listRelated(productId, limit),
  };
}
