import { Type, type Static } from '@sinclair/typebox';
import { PositiveIntegerString } from './common.js';
import { Product } from './products.js';

export const AddFavouriteBody = Type.Object({ productId: PositiveIntegerString });
export type AddFavouriteBody = Static<typeof AddFavouriteBody>;
export const FavouriteIdParam = Type.Object({ productId: PositiveIntegerString });
export const FavouritesListResponse = Type.Array(Product);
export type FavouritesListResponse = Static<typeof FavouritesListResponse>;
