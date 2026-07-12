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

export function getApiProductImage(
  imageSetId: string | null,
  fallbackSrc: string,
  alt: string,
): ApiProductImage {
  const generated = imageSetId ? cardPaths[imageSetId] : undefined;
  return {
    src: generated ?? fallbackSrc,
    alt,
    width: generated ? 720 : 800,
    height: generated ? 720 : 800,
  };
}
