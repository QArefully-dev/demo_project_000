import type { Product, ProductImage } from '@shop/contracts';

export type ProductMediaRole = 'thumbnail' | 'card' | 'detail';

function unknownImage(product: Product, role: ProductMediaRole): ProductImage {
  const size = role === 'thumbnail' ? 320 : role === 'card' ? 720 : 1200;
  const label = product.name.replace(/[<>&]/g, '');
  return {
    src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#eeeae4"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#57534e" font-family="sans-serif" font-size="32">${label}</text></svg>`)}`,
    alt: product.name,
    width: size,
    height: size,
    role,
  };
}

/** API contract is authoritative. This fallback is only for missing/corrupt records. */
export function resolveProductImage(
  product: Product,
  role: ProductMediaRole = 'card',
  imageIndex = 0,
): ProductImage {
  const roleImage = product.images.find((image) => image.role === role);
  if (roleImage) return roleImage;
  const untypedImage = product.images[imageIndex] ?? product.images[0];
  return untypedImage ?? unknownImage(product, role);
}

export function resolveProductImages(product: Product): readonly ProductImage[] {
  const detail = product.images.find((image) => image.role === 'detail');
  if (detail) return [detail];
  return product.images.length > 0 ? product.images : [unknownImage(product, 'detail')];
}
