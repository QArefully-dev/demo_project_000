/**
 * Favourites domain — stub (Wave 0).
 * Full implementation deferred to W2.A.
 */

export interface FavouriteRow {
  id: number;
  user_id: number;
  product_id: number;
  created_at: string;
}

/** Stub: list favourites for a user. */
export function listFavourites(_userId: number): FavouriteRow[] {
  void _userId;
  return [];
}

/** Stub: add a product to favourites. */
export function addFavourite(_userId: number, _productId: string): true | 'NOT_FOUND' {
  void _userId;
  void _productId;
  return 'NOT_FOUND';
}

/** Stub: remove a product from favourites. */
export function removeFavourite(_userId: number, _productId: string): true | 'NOT_FOUND' {
  void _userId;
  void _productId;
  return 'NOT_FOUND';
}
