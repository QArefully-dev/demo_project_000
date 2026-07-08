import type Database from 'better-sqlite3';

const PRODUCT_ROWS = [
  {
    id: 1,
    name: 'Wireless Noise-Canceling Headphones',
    description:
      'Premium over-ear headphones with active noise cancellation, 30-hour battery life, and rich balanced sound.',
    price_cents: 7995,
    category: 'Audio',
    stock_count: 15,
    image_url: '/images/product-headphones.jpg',
  },
  {
    id: 2,
    name: 'USB-C Multiport Hub',
    description:
      '7-in-1 USB-C hub with HDMI 4K output, 3x USB 3.0 ports, SD/microSD slots, and 100W pass-through charging.',
    price_cents: 3495,
    category: 'Accessories',
    stock_count: 30,
    image_url: '/images/product-usbhub.jpg',
  },
  {
    id: 3,
    name: 'Mechanical Keyboard RGB',
    description:
      'Full-size mechanical keyboard with hot-swappable switches, per-key RGB backlighting, and aircraft-grade aluminum frame.',
    price_cents: 10995,
    category: 'Peripherals',
    stock_count: 10,
    image_url: '/images/product-keyboard.jpg',
  },
  {
    id: 4,
    name: '4K Ultra HD Webcam',
    description:
      'Professional-grade webcam with 4K resolution, auto-focus, built-in ring light, and noise-reducing dual microphones.',
    price_cents: 5995,
    category: 'Peripherals',
    stock_count: 22,
    image_url: '/images/product-webcam.jpg',
  },
  {
    id: 5,
    name: 'Portable Bluetooth Speaker',
    description:
      'Compact waterproof speaker with 360-degree sound, 12-hour battery, and built-in microphone for calls.',
    price_cents: 4495,
    category: 'Audio',
    stock_count: 28,
    image_url: '/images/product-speaker.jpg',
  },
  {
    id: 6,
    name: 'Ergonomic Wireless Mouse',
    description:
      'Vertical wireless mouse with adjustable DPI, ergonomic grip for reduced wrist strain, and multi-device Bluetooth.',
    price_cents: 2995,
    category: 'Peripherals',
    stock_count: 35,
    image_url: '/images/product-mouse.jpg',
  },
  {
    id: 7,
    name: '27-inch 4K IPS Monitor',
    description:
      'Ultra-sharp 27-inch 4K UHD IPS display with 99% sRGB, USB-C connectivity, and built-in speakers.',
    price_cents: 34995,
    category: 'Displays',
    stock_count: 7,
    image_url: '/images/product-monitor.jpg',
  },
  {
    id: 8,
    name: 'Aluminum Laptop Stand',
    description:
      'Adjustable aluminum laptop stand with ventilated design, cable management, and fold-flat portability.',
    price_cents: 2495,
    category: 'Accessories',
    stock_count: 40,
    image_url: '/images/product-stand.jpg',
  },
] as const;

/**
 * Seeds the database with the canonical electronics product catalog
 * and a SAVE10 promo code.
 *
 * Deterministic upsert — existing known rows converge to canonical values
 * while preserving unknown non-seed rows. Safe to call every startup.
 *
 * @param db The SQLite database instance.
 */
export function seedDatabase(db: Database.Database): void {
  const seed = db.transaction(() => {
    const upsertProduct = db.prepare(
      `INSERT INTO products (id, name, description, price_cents, category, stock_count, image_url)
       VALUES (@id, @name, @description, @price_cents, @category, @stock_count, @image_url)
       ON CONFLICT(id) DO UPDATE SET
         name          = excluded.name,
         description   = excluded.description,
         price_cents   = excluded.price_cents,
         category      = excluded.category,
         stock_count   = excluded.stock_count,
         image_url     = excluded.image_url`,
    );

    for (const p of PRODUCT_ROWS) {
      upsertProduct.run(p);
    }

    db.prepare(
      `INSERT INTO promo_codes (code, discount_percent, min_item_count, active)
       VALUES ('SAVE10', 10, 5, 1)
       ON CONFLICT(code) DO UPDATE SET
         discount_percent = 10,
         min_item_count   = 5,
         active           = 1`,
    ).run();
  });

  seed();
}
