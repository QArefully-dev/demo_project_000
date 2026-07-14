import { apiFetch } from './client';
import { FavouritesListResponse } from '@shop/contracts/favourites';
import type { AddFavouriteBody } from '@shop/contracts/favourites';
import { SuccessResponse } from '@shop/contracts/common';

export function getFavourites(): Promise<FavouritesListResponse> {
  return apiFetch(FavouritesListResponse, '/api/favourites');
}

export function addFavourite(productId: string): Promise<SuccessResponse> {
  const body: AddFavouriteBody = { productId };
  return apiFetch(SuccessResponse, '/api/favourites', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function removeFavourite(productId: string): Promise<SuccessResponse> {
  return apiFetch(SuccessResponse, `/api/favourites/${productId}`, {
    method: 'DELETE',
  });
}
