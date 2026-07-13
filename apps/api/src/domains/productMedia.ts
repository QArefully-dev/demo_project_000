import { getProductMediaSet, type GeneratedProductImage } from '@shop/contracts';

export type ApiProductImage = GeneratedProductImage;

function unknownImage(alt: string): ApiProductImage {
  const size = 720;
  const label = alt.replace(/[<>&]/g, '');
  return {
    src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#eeeae4"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#57534e" font-family="sans-serif" font-size="32">${label}</text></svg>`)}`,
    alt,
    width: size,
    height: size,
    role: 'card',
  };
}

/** Generated registry is contract source for every checked-in powder rendition. */
export function getApiProductImages(
  imageSetId: string | null,
  _category: string,
  alt: string,
): ApiProductImage[] {
  const images = getProductMediaSet(imageSetId);
  return images.length > 0 ? [...images] : [unknownImage(alt)];
}
