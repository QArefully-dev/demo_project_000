import { apiFetch } from './client';
import type {
  FavouritesListResponse,
  AddFavouriteBody,
  SuccessResponse,
} from '@shop/contracts';

/**
 * Favourites API module — stubs (Wave 0).
 * All endpoints return 501 at this stage.
 * Real implementation deferred to W2.A.
 */

export function getFavourites(): Promise<FavouritesListResponse> {
  return apiFetch<FavouritesListResponse>('/api/favourites');
}

export function addFavourite(productId: string): Promise<SuccessResponse> {
  const body: AddFavouriteBody = { productId };
  return apiFetch<SuccessResponse>('/api/favourites', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function removeFavourite(productId: string): Promise<SuccessResponse> {
  return apiFetch<SuccessResponse>(`/api/favourites/${productId}`, {
    method: 'DELETE',
  });
}
