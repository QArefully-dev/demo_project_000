export interface ApiProductImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const cardPaths: Readonly<Record<string, string>> = {
  headphones: '/images/products/wireless-headphones.card.1bec8d07bb59.720.webp',
  keyboard: '/images/products/mechanical-keyboard.card.24a705d3f3c5.720.webp',
  monitor: '/images/products/desktop-monitor.card.60700175c6db.720.webp',
  mouse: '/images/products/wireless-mouse.card.77ec7dc8214c.720.webp',
  speaker: '/images/products/portable-speaker.card.c874cf8d8eca.720.webp',
  stand: '/images/products/laptop-stand.card.057302deede7.720.webp',
  'usb-hub': '/images/products/usb-hub.card.9b304cc40aad.720.webp',
  webcam: '/images/products/webcam.card.61c6d85cc7a0.720.webp',
};

const categoryFallbacks: Readonly<Record<string, keyof typeof cardPaths>> = {
  accessories: 'usb-hub',
  audio: 'headphones',
  cables: 'usb-hub',
  displays: 'monitor',
  networking: 'usb-hub',
  peripherals: 'keyboard',
  power: 'usb-hub',
  'smart home': 'webcam',
  storage: 'usb-hub',
  wearables: 'mouse',
};

function unknownImage(alt: string): ApiProductImage {
  const size = 720;
  const label = alt.replace(/[<>&]/g, '');
  return {
    src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#eeeae4"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#57534e" font-family="sans-serif" font-size="32">${label}</text></svg>`)}`,
    alt,
    width: size,
    height: size,
  };
}

/** Resolve contract image data from the durable set ID, never the legacy URL column. */
export function getApiProductImages(
  imageSetId: string | null,
  category: string,
  alt: string,
): ApiProductImage[] {
  const resolvedSetId =
    (imageSetId && cardPaths[imageSetId] ? imageSetId : undefined) ??
    categoryFallbacks[category.toLowerCase()];
  const src = resolvedSetId ? cardPaths[resolvedSetId] : undefined;
  return src ? [{ src, alt, width: 720, height: 720 }] : [unknownImage(alt)];
}
