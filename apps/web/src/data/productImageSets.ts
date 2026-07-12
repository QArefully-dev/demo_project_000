import type { Product, ProductImage } from '@shop/contracts';

export type ProductMediaRole = 'thumbnail' | 'card' | 'detail';
export type ProductImageSet = Readonly<Record<ProductMediaRole, ProductImage>>;

const image = (src: string, alt: string, size: number): ProductImage => ({
  src,
  alt,
  width: size,
  height: size,
});

const set = (alt: string, thumbnail: string, card: string, detail: string): ProductImageSet => ({
  thumbnail: image(thumbnail, alt, 320),
  card: image(card, alt, 720),
  detail: image(detail, alt, 1200),
});

export const productImageSets: Readonly<Record<string, ProductImageSet>> = {
  headphones: set(
    'Over-ear headphones',
    '/images/products/wireless-headphones.thumbnail.3fc685d48366.320.webp',
    '/images/products/wireless-headphones.card.1bec8d07bb59.720.webp',
    '/images/products/wireless-headphones.detail.09cd9a0b2710.1200.webp',
  ),
  keyboard: set(
    'Mechanical keyboard',
    '/images/products/mechanical-keyboard.thumbnail.003d71581792.320.webp',
    '/images/products/mechanical-keyboard.card.24a705d3f3c5.720.webp',
    '/images/products/mechanical-keyboard.detail.6f2453e3016d.1200.webp',
  ),
  monitor: set(
    'Desktop monitor',
    '/images/products/desktop-monitor.thumbnail.9e7f5f18b393.320.webp',
    '/images/products/desktop-monitor.card.60700175c6db.720.webp',
    '/images/products/desktop-monitor.detail.6c93ebef7d3a.1200.webp',
  ),
  mouse: set(
    'Wireless mouse',
    '/images/products/wireless-mouse.thumbnail.58fed3e7b09e.320.webp',
    '/images/products/wireless-mouse.card.77ec7dc8214c.720.webp',
    '/images/products/wireless-mouse.detail.fd3919d49022.1200.webp',
  ),
  speaker: set(
    'Portable speaker',
    '/images/products/portable-speaker.thumbnail.74d1b5b37831.320.webp',
    '/images/products/portable-speaker.card.c874cf8d8eca.720.webp',
    '/images/products/portable-speaker.detail.bc6d73537ba9.1200.webp',
  ),
  stand: set(
    'Aluminium laptop stand',
    '/images/products/laptop-stand.thumbnail.1797f3623612.320.webp',
    '/images/products/laptop-stand.card.057302deede7.720.webp',
    '/images/products/laptop-stand.detail.9bb0069ff67a.1200.webp',
  ),
  'usb-hub': set(
    'USB-C multiport hub',
    '/images/products/usb-hub.thumbnail.19fb1698f58d.320.webp',
    '/images/products/usb-hub.card.9b304cc40aad.720.webp',
    '/images/products/usb-hub.detail.a939856c8b8a.1200.webp',
  ),
  webcam: set(
    'Desktop webcam',
    '/images/products/webcam.thumbnail.8cd5ef6756ad.320.webp',
    '/images/products/webcam.card.61c6d85cc7a0.720.webp',
    '/images/products/webcam.detail.b79792faa84f.1200.webp',
  ),
};

const categoryFallbacks: Readonly<Record<string, string>> = {
  audio: 'headphones',
  displays: 'monitor',
  peripherals: 'keyboard',
};

function unknownImage(product: Product, role: ProductMediaRole): ProductImage {
  const size = role === 'thumbnail' ? 320 : role === 'card' ? 720 : 1200;
  return {
    src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#eeeae4"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#57534e" font-family="sans-serif" font-size="32">${product.name.replace(/[<>&]/g, '')}</text></svg>`)}`,
    alt: product.name,
    width: size,
    height: size,
  };
}

export function resolveProductImage(
  product: Product,
  role: ProductMediaRole = 'card',
): ProductImage {
  const registered = productImageSets[product.imageSetId];
  if (registered) return registered[role];

  const categorySet =
    productImageSets[categoryFallbacks[product.category.toLowerCase()] ?? 'usb-hub'];
  return categorySet?.[role] ?? unknownImage(product, role);
}

/** Logical gallery images. Rendition selection is handled separately by ProductMedia. */
export function resolveProductImages(product: Product): readonly ProductImage[] {
  return [resolveProductImage(product, 'detail')];
}
