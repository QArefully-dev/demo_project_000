import type { ProductRow } from '../catalog/productRepository.js';
import type { FavouritesRepository } from './favouritesRepository.js';

export interface FavouritesService {
  list(userId: number): ProductRow[];
  add(userId: number, productId: number): true | 'NOT_FOUND';
  remove(userId: number, productId: number): true | 'NOT_FOUND';
}

export function createFavouritesService(repository: FavouritesRepository): FavouritesService {
  return {
    list: (userId) => listFavourites(repository, userId),
    add: (userId, productId) => addFavourite(repository, userId, productId),
    remove: (userId, productId) => removeFavourite(repository, userId, productId),
  };
}

export function listFavourites(repository: FavouritesRepository, userId: number): ProductRow[] {
  return repository.list(userId);
}

export function addFavourite(
  repository: FavouritesRepository,
  userId: number,
  productId: number,
): true | 'NOT_FOUND' {
  if (!repository.productExists(productId)) return 'NOT_FOUND';
  repository.add(userId, productId);
  return true;
}

export function removeFavourite(
  repository: FavouritesRepository,
  userId: number,
  productId: number,
): true | 'NOT_FOUND' {
  return repository.remove(userId, productId) ? true : 'NOT_FOUND';
}
