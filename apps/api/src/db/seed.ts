import { createHash, scryptSync } from 'node:crypto';
import type Database from 'better-sqlite3';

// ── Product categories ────────────────────────────────────
// Audio, Peripherals, Displays, Accessories, Storage, Networking, Power, Cables, Wearables, Smart Home

const PRODUCT_ROWS = [
  // Preserved: existing 8 products (IDs 1-8)
  {
    id: 1,
    name: 'Wireless Noise-Canceling Headphones',
    description:
      'Premium over-ear headphones with active noise cancellation, 30-hour battery life, and rich balanced sound.',
    price_cents: 7995,
    category: 'Audio',
    stock_count: 15,
    image_set_id: 'headphones',
    slug: 'wireless-noise-canceling-headphones',
    compare_at_price_cents: null,
    sales_count: 320,
  },
  {
    id: 2,
    name: 'USB-C Multiport Hub',
    description:
      '7-in-1 USB-C hub with HDMI 4K output, 3x USB 3.0 ports, SD/microSD slots, and 100W pass-through charging.',
    price_cents: 3495,
    category: 'Accessories',
    stock_count: 30,
    image_set_id: 'usb-hub',
    slug: 'usb-c-multiport-hub',
    compare_at_price_cents: null,
    sales_count: 180,
  },
  {
    id: 3,
    name: 'Mechanical Keyboard RGB',
    description:
      'Full-size mechanical keyboard with hot-swappable switches, per-key RGB backlighting, and aircraft-grade aluminum frame.',
    price_cents: 10995,
    category: 'Peripherals',
    stock_count: 10,
    image_set_id: 'keyboard',
    slug: 'mechanical-keyboard-rgb',
    compare_at_price_cents: null,
    sales_count: 260,
  },
  {
    id: 4,
    name: '4K Ultra HD Webcam',
    description:
      'Professional-grade webcam with 4K resolution, auto-focus, built-in ring light, and noise-reducing dual microphones.',
    price_cents: 5995,
    category: 'Peripherals',
    stock_count: 22,
    image_set_id: 'webcam',
    slug: '4k-ultra-hd-webcam',
    compare_at_price_cents: null,
    sales_count: 400,
  },
  {
    id: 5,
    name: 'Portable Bluetooth Speaker',
    description:
      'Compact waterproof speaker with 360-degree sound, 12-hour battery, and built-in microphone for calls.',
    price_cents: 4495,
    category: 'Audio',
    stock_count: 28,
    image_set_id: 'speaker',
    slug: 'portable-bluetooth-speaker',
    compare_at_price_cents: null,
    sales_count: 450,
  },
  {
    id: 6,
    name: 'Ergonomic Wireless Mouse',
    description:
      'Vertical wireless mouse with adjustable DPI, ergonomic grip for reduced wrist strain, and multi-device Bluetooth.',
    price_cents: 2995,
    category: 'Peripherals',
    stock_count: 35,
    image_set_id: 'mouse',
    slug: 'ergonomic-wireless-mouse',
    compare_at_price_cents: 3995,
    sales_count: 500,
  },
  {
    id: 7,
    name: '27-inch 4K IPS Monitor',
    description:
      'Ultra-sharp 27-inch 4K UHD IPS display with 99% sRGB, USB-C connectivity, and built-in speakers.',
    price_cents: 34995,
    category: 'Displays',
    stock_count: 7,
    image_set_id: 'monitor',
    slug: '27-inch-4k-ips-monitor',
    compare_at_price_cents: 39995,
    sales_count: 95,
  },
  {
    id: 8,
    name: 'Aluminum Laptop Stand',
    description:
      'Adjustable aluminum laptop stand with ventilated design, cable management, and fold-flat portability.',
    price_cents: 2495,
    category: 'Accessories',
    stock_count: 40,
    image_set_id: 'stand',
    slug: 'aluminum-laptop-stand',
    compare_at_price_cents: null,
    sales_count: 200,
  },
  // New products (IDs 9-45)
  {
    id: 9,
    name: 'Studio Monitor Speakers',
    description:
      'Professional near-field studio monitors with flat frequency response, bi-amplified design, and XLR/TRS inputs.',
    price_cents: 19995,
    category: 'Audio',
    stock_count: 12,
    image_set_id: 'speaker',
    slug: 'studio-monitor-speakers',
    compare_at_price_cents: 24995,
    sales_count: 60,
  },
  {
    id: 10,
    name: 'Wireless Earbuds Pro',
    description:
      'True wireless earbuds with adaptive ANC, spatial audio, IPX5 water resistance, and wireless charging case.',
    price_cents: 12995,
    category: 'Audio',
    stock_count: 25,
    image_set_id: 'headphones',
    slug: 'wireless-earbuds-pro',
    compare_at_price_cents: 14995,
    sales_count: 380,
  },
  {
    id: 11,
    name: 'USB-C to HDMI Adapter',
    description:
      'Compact USB-C to HDMI 2.0 adapter supporting 4K@60Hz, plug-and-play, aluminum housing.',
    price_cents: 1995,
    category: 'Cables',
    stock_count: 50,
    image_set_id: 'usb-hub',
    slug: 'usb-c-to-hdmi-adapter',
    compare_at_price_cents: null,
    sales_count: 120,
  },
  {
    id: 12,
    name: 'Braided USB-C Cable 2m',
    description:
      'Durable braided USB-C to USB-C cable with 100W PD charging, 10Gbps data transfer, 2-meter length.',
    price_cents: 1495,
    category: 'Cables',
    stock_count: 60,
    image_set_id: 'usb-hub',
    slug: 'braided-usb-c-cable-2m',
    compare_at_price_cents: null,
    sales_count: 80,
  },
  {
    id: 13,
    name: 'Wi-Fi 6E Mesh Router',
    description:
      'Tri-band Wi-Fi 6E mesh system covering up to 550 sqm, with 2.5G WAN port and easy app setup.',
    price_cents: 29995,
    category: 'Networking',
    stock_count: 8,
    image_set_id: 'usb-hub',
    slug: 'wifi-6e-mesh-router',
    compare_at_price_cents: 34995,
    sales_count: 45,
  },
  {
    id: 14,
    name: 'Network Switch 8-Port Gigabit',
    description:
      'Unmanaged 8-port gigabit Ethernet switch with fanless metal housing, auto-MDI/MDIX, plug-and-play.',
    price_cents: 3495,
    category: 'Networking',
    stock_count: 20,
    image_set_id: 'usb-hub',
    slug: 'network-switch-8-port-gigabit',
    compare_at_price_cents: null,
    sales_count: 60,
  },
  {
    id: 15,
    name: 'Portable SSD 1TB',
    description:
      'Pocket-sized 1TB external SSD with USB 3.2 Gen 2, 1050MB/s read speeds, shock-resistant.',
    price_cents: 9995,
    category: 'Storage',
    stock_count: 18,
    image_set_id: 'usb-hub',
    slug: 'portable-ssd-1tb',
    compare_at_price_cents: 12995,
    sales_count: 210,
  },
  {
    id: 16,
    name: 'NVMe SSD 2TB Internal',
    description: 'PCIe Gen 4 NVMe M.2 SSD with 7000MB/s read, 2TB capacity, heatsink included.',
    price_cents: 16995,
    category: 'Storage',
    stock_count: 14,
    image_set_id: 'usb-hub',
    slug: 'nvme-ssd-2tb-internal',
    compare_at_price_cents: 19995,
    sales_count: 280,
  },
  {
    id: 17,
    name: 'MicroSD Card 512GB',
    description:
      'UHS-I U3 V30 microSD card with 160MB/s read, ideal for 4K video recording and gaming.',
    price_cents: 4495,
    category: 'Storage',
    stock_count: 35,
    image_set_id: 'usb-hub',
    slug: 'microsd-card-512gb',
    compare_at_price_cents: null,
    sales_count: 95,
  },
  {
    id: 18,
    name: '100W GaN USB-C Charger',
    description:
      'Compact GaN charger with dual USB-C and one USB-A port, 100W total output, foldable plug.',
    price_cents: 3995,
    category: 'Power',
    stock_count: 30,
    image_set_id: 'usb-hub',
    slug: '100w-gan-usb-c-charger',
    compare_at_price_cents: null,
    sales_count: 190,
  },
  {
    id: 19,
    name: 'Wireless Charging Pad',
    description:
      '15W fast wireless charging pad compatible with Qi devices, slim design with LED indicator.',
    price_cents: 2495,
    category: 'Power',
    stock_count: 40,
    image_set_id: 'usb-hub',
    slug: 'wireless-charging-pad',
    compare_at_price_cents: null,
    sales_count: 150,
  },
  {
    id: 20,
    name: 'Portable Power Bank 20000mAh',
    description:
      'High-capacity 20000mAh power bank with 65W PD output, dual USB-C, digital display.',
    price_cents: 4995,
    category: 'Power',
    stock_count: 22,
    image_set_id: 'usb-hub',
    slug: 'portable-power-bank-20000mah',
    compare_at_price_cents: 5995,
    sales_count: 340,
  },
  {
    id: 21,
    name: '34-inch Ultrawide Monitor',
    description:
      '34-inch 3440x1440 curved IPS ultrawide with 144Hz refresh, FreeSync Premium, USB-C docking.',
    price_cents: 54995,
    category: 'Displays',
    stock_count: 5,
    image_set_id: 'monitor',
    slug: '34-inch-ultrawide-monitor',
    compare_at_price_cents: 64995,
    sales_count: 300,
  },
  {
    id: 22,
    name: 'Portable Monitor 15.6-inch',
    description:
      'USB-C portable monitor, 1080p IPS, slim design with smart cover stand, dual speakers.',
    price_cents: 18995,
    category: 'Displays',
    stock_count: 9,
    image_set_id: 'monitor',
    slug: 'portable-monitor-15-6-inch',
    compare_at_price_cents: null,
    sales_count: 110,
  },
  {
    id: 23,
    name: 'Monitor Arm Gas Spring',
    description:
      'Full-motion gas spring monitor arm for 17-32 inch screens, supports 2-9kg, integrated cable management.',
    price_cents: 5995,
    category: 'Accessories',
    stock_count: 15,
    image_set_id: 'stand',
    slug: 'monitor-arm-gas-spring',
    compare_at_price_cents: null,
    sales_count: 75,
  },
  {
    id: 24,
    name: 'Laptop Sleeve 14-inch',
    description:
      'Water-resistant neoprene laptop sleeve with soft fleece lining, fits most 14-inch laptops.',
    price_cents: 1995,
    category: 'Accessories',
    stock_count: 45,
    image_set_id: 'stand',
    slug: 'laptop-sleeve-14-inch',
    compare_at_price_cents: null,
    sales_count: 50,
  },
  {
    id: 25,
    name: 'Vertical Laptop Dock',
    description:
      'Vertical USB-C docking station with dual 4K display support, 9 ports, 85W laptop charging.',
    price_cents: 14995,
    category: 'Accessories',
    stock_count: 11,
    image_set_id: 'usb-hub',
    slug: 'vertical-laptop-dock',
    compare_at_price_cents: 17995,
    sales_count: 90,
  },
  {
    id: 26,
    name: 'Gaming Mouse Pad XL',
    description:
      'Extended 900x400mm gaming mouse pad with stitched edges, non-slip rubber base, smooth cloth surface.',
    price_cents: 2495,
    category: 'Peripherals',
    stock_count: 28,
    image_set_id: 'mouse',
    slug: 'gaming-mouse-pad-xl',
    compare_at_price_cents: null,
    sales_count: 130,
  },
  {
    id: 27,
    name: 'Mechanical Numpad',
    description: 'USB-C mechanical numpad with hot-swappable switches, per-key RGB, PBT keycaps.',
    price_cents: 3495,
    category: 'Peripherals',
    stock_count: 20,
    image_set_id: 'keyboard',
    slug: 'mechanical-numpad',
    compare_at_price_cents: null,
    sales_count: 40,
  },
  {
    id: 28,
    name: 'Smart LED Light Strip 5m',
    description:
      'Wi-Fi enabled RGBIC LED strip with music sync, voice control, 16 million colors, 5-meter length.',
    price_cents: 2995,
    category: 'Smart Home',
    stock_count: 40,
    image_set_id: 'usb-hub',
    slug: 'smart-led-light-strip-5m',
    compare_at_price_cents: null,
    sales_count: 220,
  },
  {
    id: 29,
    name: 'Smart Plug Energy Monitor',
    description:
      'Wi-Fi smart plug with real-time energy monitoring, scheduling, voice assistant compatible.',
    price_cents: 1995,
    category: 'Smart Home',
    stock_count: 35,
    image_set_id: 'usb-hub',
    slug: 'smart-plug-energy-monitor',
    compare_at_price_cents: null,
    sales_count: 160,
  },
  {
    id: 30,
    name: 'Video Doorbell WiFi',
    description:
      '1080p HD video doorbell with two-way audio, night vision, motion detection, cloud/local storage.',
    price_cents: 7995,
    category: 'Smart Home',
    stock_count: 15,
    image_set_id: 'webcam',
    slug: 'video-doorbell-wifi',
    compare_at_price_cents: 9995,
    sales_count: 85,
  },
  {
    id: 31,
    name: 'Fitness Smartwatch',
    description:
      'AMOLED fitness smartwatch with GPS, heart rate, SpO2, sleep tracking, 14-day battery.',
    price_cents: 19995,
    category: 'Wearables',
    stock_count: 18,
    image_set_id: 'mouse',
    slug: 'fitness-smartwatch',
    compare_at_price_cents: 24995,
    sales_count: 410,
  },
  {
    id: 32,
    name: 'Smart Ring Health Tracker',
    description:
      'Titanium smart ring with sleep, activity, HRV, and temperature tracking, 7-day battery.',
    price_cents: 29995,
    category: 'Wearables',
    stock_count: 6,
    image_set_id: 'mouse',
    slug: 'smart-ring-health-tracker',
    compare_at_price_cents: null,
    sales_count: 35,
  },
  {
    id: 33,
    name: 'Bluetooth Tracker Tag',
    description:
      'Coin-sized Bluetooth tracker with replaceable battery, crowd-find network, 100m range.',
    price_cents: 2495,
    category: 'Wearables',
    stock_count: 42,
    image_set_id: 'mouse',
    slug: 'bluetooth-tracker-tag',
    compare_at_price_cents: null,
    sales_count: 290,
  },
  {
    id: 34,
    name: 'Thunderbolt 4 Cable 1m',
    description: 'Certified Thunderbolt 4 cable, 40Gbps data, 100W charging, 8K video, 1-meter.',
    price_cents: 3995,
    category: 'Cables',
    stock_count: 25,
    image_set_id: 'usb-hub',
    slug: 'thunderbolt-4-cable-1m',
    compare_at_price_cents: null,
    sales_count: 55,
  },
  {
    id: 35,
    name: 'HDMI 2.1 Cable 3m',
    description: 'Ultra high-speed HDMI 2.1 cable, 48Gbps, 8K@60Hz, 4K@120Hz, HDR, eARC, 3-meter.',
    price_cents: 2495,
    category: 'Cables',
    stock_count: 35,
    image_set_id: 'usb-hub',
    slug: 'hdmi-2-1-cable-3m',
    compare_at_price_cents: null,
    sales_count: 70,
  },
  {
    id: 36,
    name: '5-Port Gigabit PoE Switch',
    description: '5-port gigabit PoE+ switch with 65W total budget, fanless design, VLAN support.',
    price_cents: 6995,
    category: 'Networking',
    stock_count: 12,
    image_set_id: 'usb-hub',
    slug: '5-port-gigabit-poe-switch',
    compare_at_price_cents: null,
    sales_count: 30,
  },
  {
    id: 37,
    name: 'USB WiFi Adapter AC1300',
    description: 'Dual-band AC1300 USB 3.0 WiFi adapter with high-gain antenna, MU-MIMO support.',
    price_cents: 2995,
    category: 'Networking',
    stock_count: 25,
    image_set_id: 'usb-hub',
    slug: 'usb-wifi-adapter-ac1300',
    compare_at_price_cents: null,
    sales_count: 105,
  },
  {
    id: 38,
    name: 'Surge Protector 8-Outlet',
    description: '8-outlet surge protector with 4320J protection, 4 USB charging ports, 2m cord.',
    price_cents: 3495,
    category: 'Power',
    stock_count: 20,
    image_set_id: 'usb-hub',
    slug: 'surge-protector-8-outlet',
    compare_at_price_cents: null,
    sales_count: 140,
  },
  {
    id: 39,
    name: 'Smart Thermostat',
    description:
      'Wi-Fi programmable thermostat with geofencing, energy reports, voice control compatibility.',
    price_cents: 12995,
    category: 'Smart Home',
    stock_count: 10,
    image_set_id: 'usb-hub',
    slug: 'smart-thermostat',
    compare_at_price_cents: 14995,
    sales_count: 65,
  },
  {
    id: 40,
    name: 'Smart Lock Keyless Entry',
    description:
      'Keyless smart door lock with fingerprint, PIN, app control, auto-lock, and activity log.',
    price_cents: 15995,
    category: 'Smart Home',
    stock_count: 7,
    image_set_id: 'usb-hub',
    slug: 'smart-lock-keyless-entry',
    compare_at_price_cents: null,
    sales_count: 48,
  },
  {
    id: 41,
    name: 'Wireless Earbuds Sport',
    description:
      'Sweatproof wireless sport earbuds with ear hooks, 8-hour battery, deep bass sound.',
    price_cents: 4995,
    category: 'Audio',
    stock_count: 30,
    image_set_id: 'headphones',
    slug: 'wireless-earbuds-sport',
    compare_at_price_cents: null,
    sales_count: 175,
  },
  {
    id: 42,
    name: 'USB Microphone Podcast Kit',
    description:
      'Cardioid condenser USB microphone with boom arm, pop filter, and shock mount for streaming.',
    price_cents: 6995,
    category: 'Audio',
    stock_count: 16,
    image_set_id: 'webcam',
    slug: 'usb-microphone-podcast-kit',
    compare_at_price_cents: 8995,
    sales_count: 88,
  },
  {
    id: 43,
    name: 'External Blu-ray Drive',
    description: 'USB 3.0 external Blu-ray/DVD/CD writer, slim portable design, M-DISC support.',
    price_cents: 7995,
    category: 'Storage',
    stock_count: 8,
    image_set_id: 'usb-hub',
    slug: 'external-blu-ray-drive',
    compare_at_price_cents: null,
    sales_count: 20,
  },
  {
    id: 44,
    name: 'Standing Desk Converter',
    description:
      'Height-adjustable standing desk converter with gas spring lift, keyboard tray, fits dual monitors.',
    price_cents: 24995,
    category: 'Accessories',
    stock_count: 6,
    image_set_id: 'stand',
    slug: 'standing-desk-converter',
    compare_at_price_cents: 29995,
    sales_count: 55,
  },
  {
    id: 45,
    name: 'GPU Support Bracket',
    description:
      'Adjustable aluminum GPU support bracket with magnetic base, anti-sag for heavy graphics cards.',
    price_cents: 1495,
    category: 'Accessories',
    stock_count: 32,
    image_set_id: 'stand',
    slug: 'gpu-support-bracket',
    compare_at_price_cents: null,
    sales_count: 25,
  },
] as const;

// ── Seed users ────────────────────────────────────────────
const USERS = [
  {
    id: 1,
    email: 'alice@example.com',
    display_name: 'Alice',
    password: 'Password123!',
    role: 'customer',
  },
  {
    id: 2,
    email: 'bob@example.com',
    display_name: 'Bob',
    password: 'Password123!',
    role: 'customer',
  },
  {
    id: 3,
    email: 'admin@example.com',
    display_name: 'Admin',
    password: 'Password123!',
    role: 'admin',
  },
];

// ── Seed promos ───────────────────────────────────────────
// code, discount_percent, min_item_count, active, kind, amount_cents, min_subtotal_cents, start_at, end_at, max_redemptions, per_user_limit
const PROMOS = [
  {
    code: 'SAVE10',
    discount_percent: 10,
    min_item_count: 5,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: null,
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'SAVE20',
    discount_percent: 20,
    min_item_count: 0,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: 10000,
    start_at: null,
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'WELCOME5',
    discount_percent: 0,
    min_item_count: 0,
    active: 1,
    kind: 'fixed',
    amount_cents: 500,
    min_subtotal_cents: null,
    start_at: null,
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: 1,
  },
  {
    code: 'VIP15',
    discount_percent: 15,
    min_item_count: 0,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: null,
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'EXPIRED10',
    discount_percent: 10,
    min_item_count: 3,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: null,
    end_at: '2025-01-01T00:00:00.000Z',
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'SOON10',
    discount_percent: 10,
    min_item_count: 3,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: '2099-01-01T00:00:00.000Z',
    end_at: null,
    max_redemptions: null,
    redemption_count: 0,
    per_user_limit: null,
  },
  {
    code: 'LIMITED5',
    discount_percent: 5,
    min_item_count: 0,
    active: 1,
    kind: 'percent',
    amount_cents: null,
    min_subtotal_cents: null,
    start_at: null,
    end_at: null,
    max_redemptions: 0,
    redemption_count: 0,
    per_user_limit: null,
  },
];

// ── Seed favourites (alice, user ID 1) ────────────────────
const ALICE_FAVOURITES = [1, 5, 10]; // Headphones, Portable Bluetooth Speaker, Wireless Earbuds Pro

/**
 * Seeds the database with the canonical electronics product catalog,
 * users, promo codes, and initial favourites.
 *
 * Deterministic upsert — existing known rows converge to canonical values
 * while preserving unknown non-seed rows. Safe to call every startup.
 *
 * @param db The SQLite database instance.
 */
export function seedDatabase(db: Database.Database): void {
  const seed = db.transaction(() => {
    // ── Products ──────────────────────────────────────────
    const upsertProduct = db.prepare(
      `INSERT INTO products (id, name, description, price_cents, category, stock_count, image_set_id, slug, compare_at_price_cents, sales_count)
       VALUES (@id, @name, @description, @price_cents, @category, @stock_count, @image_set_id, @slug, @compare_at_price_cents, @sales_count)
       ON CONFLICT(id) DO UPDATE SET
         name          = excluded.name,
         description   = excluded.description,
         price_cents   = excluded.price_cents,
         category      = excluded.category,
         stock_count   = excluded.stock_count,
         image_set_id  = excluded.image_set_id,
         slug          = excluded.slug,
         compare_at_price_cents = excluded.compare_at_price_cents,
         sales_count   = excluded.sales_count`,
    );

    for (const product of PRODUCT_ROWS) upsertProduct.run(product);

    // ── Promo codes ───────────────────────────────────────
    const upsertPromo = db.prepare(
      `INSERT INTO promo_codes (code, discount_percent, min_item_count, active, kind, amount_cents, min_subtotal_cents, start_at, end_at, max_redemptions, redemption_count, per_user_limit)
       VALUES (@code, @discount_percent, @min_item_count, @active, @kind, @amount_cents, @min_subtotal_cents, @start_at, @end_at, @max_redemptions, @redemption_count, @per_user_limit)
       ON CONFLICT(code) DO UPDATE SET
         discount_percent  = excluded.discount_percent,
         min_item_count    = excluded.min_item_count,
         active            = excluded.active,
         kind              = excluded.kind,
         amount_cents      = excluded.amount_cents,
         min_subtotal_cents = excluded.min_subtotal_cents,
         start_at          = excluded.start_at,
         end_at            = excluded.end_at,
         max_redemptions   = excluded.max_redemptions,
         redemption_count  = excluded.redemption_count,
         per_user_limit    = excluded.per_user_limit`,
    );

    for (const promo of PROMOS) {
      upsertPromo.run(promo);
    }

    // ── Users ─────────────────────────────────────────────
    const upsertUser = db.prepare(
      `INSERT INTO users (id, email, display_name, password_hash, password_salt, role)
       VALUES (@id, @email, @display_name, @password_hash, @password_salt, @role)
       ON CONFLICT(id) DO UPDATE SET
         email          = excluded.email,
         display_name   = excluded.display_name,
         password_hash  = excluded.password_hash,
         password_salt  = excluded.password_salt,
         role           = excluded.role`,
    );

    // Note: synchronous password hashing would block the event loop.
    // In a production seed script this would be async, but for the demo
    // we pre-compute hashes acceptable for deterministic seeding.
    // The passwords are rehashed on every seed run via sync scrypt.
    // We use a placeholder salt.hash format; the real hashing is done
    // synchronously below.
    for (const user of USERS) {
      // Deterministic salt from email for idempotent seed.
      // Stores combined "salt.hash" format in password_hash (consistent with hashPassword).
      const deterministicSalt = createHash('sha256')
        .update(`seed-salt-${user.email}`)
        .digest('hex')
        .slice(0, 64);
      const derived = scryptSync('Password123!', deterministicSalt, 64);
      const combined = `${deterministicSalt}.${derived.toString('hex')}`;
      upsertUser.run({
        ...user,
        password_hash: combined,
        password_salt: '',
      });
    }

    // Clear sessions for seeded users (seeds should not persist sessions)
    db.prepare('DELETE FROM sessions WHERE user_id IN (1, 2, 3)').run();
    // Clear unused reset tokens for seeded users
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id IN (1, 2, 3)').run();

    // ── Favourites for Alice ──────────────────────────────
    // Only add if not already present (idempotent via IGNORE).
    const addFav = db.prepare(
      `INSERT OR IGNORE INTO favourites (user_id, product_id) VALUES (?, ?)`,
    );
    for (const pid of ALICE_FAVOURITES) {
      addFav.run(1, pid);
    }

    // ── Assert post-seed counts ───────────────────────────
    const productCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number })
      .c;
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const promoCount = (db.prepare('SELECT COUNT(*) as c FROM promo_codes').get() as { c: number })
      .c;
    const favCount = (db.prepare('SELECT COUNT(*) as c FROM favourites').get() as { c: number }).c;
    const sessionCount = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as { c: number })
      .c;
    const mailboxCount = (
      db.prepare('SELECT COUNT(*) as c FROM dev_mailbox').get() as { c: number }
    ).c;

    const assert = (label: string, expected: number, actual: number) => {
      if (actual !== expected) {
        throw new Error(`Seed assertion failed: ${label} expected ${expected}, got ${actual}`);
      }
    };

    assert('products', 45, productCount);
    assert('users', 3, userCount);
    assert('promo_codes', 7, promoCount);
    assert('favourites', 3, favCount);
    assert('sessions', 0, sessionCount);
    assert('dev_mailbox', 0, mailboxCount);

    // Assert SAVE10
    const save10 = db.prepare("SELECT * FROM promo_codes WHERE code = 'SAVE10'").get() as
      | {
          kind: string;
          discount_percent: number;
          min_item_count: number;
          active: number;
        }
      | undefined;
    if (!save10) throw new Error('Seed assertion failed: SAVE10 missing');
    if (save10.kind !== 'percent')
      throw new Error('Seed assertion failed: SAVE10 kind not percent');
    if (save10.discount_percent !== 10)
      throw new Error('Seed assertion failed: SAVE10 discount not 10');
    if (save10.min_item_count !== 5)
      throw new Error('Seed assertion failed: SAVE10 min_item_count not 5');
    if (save10.active !== 1) throw new Error('Seed assertion failed: SAVE10 not active');
  });

  seed();
}
