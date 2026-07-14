import type { ProductQuery } from '@shop/contracts/products';
import type { ProductList, ProductRepository, ProductRow } from './productRepository.js';

export interface ProductService {
  list(query: ProductQuery): ProductList;
  findById(id: number): ProductRow | undefined;
  listCategories(): string[];
  listBestsellers(limit?: number): ProductRow[];
  listRelated(productId: number, limit?: number): ProductRow[];
}

export function createProductService(repository: ProductRepository): ProductService {
  return {
    list: (query) => repository.list(query),
    findById: (id) => repository.findById(id),
    listCategories: () => repository.listCategories(),
    listBestsellers: (limit) => repository.listBestsellers(limit),
    listRelated: (productId, limit) => repository.listRelated(productId, limit),
  };
}
