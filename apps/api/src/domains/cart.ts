import { getDb } from '../db/index.js';

export interface CartLineResult {
  product_id: number;
  quantity: number;
  id: number;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  stock_count: number;
  image_url: string;
  slug: string;
  sales_count: number;
}

export interface CartResult {
  id: string;
  items: {
    productId: string;
    product: {
      id: string;
      name: string;
      description: string;
      priceCents: number;
      imageUrl: string;
      category: string;
      stock: number;
      slug: string;
      salesCount: number;
    };
    quantity: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  totalItems: number;
}

/** Create a new empty cart and return its ID. */
export function createCart(): { cartId: string } {
  const db = getDb();
  const cartId = crypto.randomUUID();
  db.prepare('INSERT INTO carts (id) VALUES (?)').run(cartId);
  return { cartId };
}

/** Check if a cart exists. */
export function cartExists(cartId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM carts WHERE id = ?').get(cartId);
  return row !== undefined;
}

/** Retrieve a cart with computed line totals and subtotal. Returns undefined if cart not found. */
export function getCart(cartId: string): CartResult | undefined {
  const db = getDb();
  const cart = db.prepare('SELECT id FROM carts WHERE id = ?').get(cartId) as
    { id: string } | undefined;
  if (!cart) return undefined;

  const rows = db
    .prepare(
      `
    SELECT cli.product_id, cli.quantity, p.id, p.name, p.description, p.price_cents, p.category, p.stock_count, p.image_url, p.slug, p.sales_count
    FROM cart_line_items cli
    JOIN products p ON cli.product_id = p.id
    WHERE cli.cart_id = ?
  `,
    )
    .all(cartId) as CartLineResult[];

  const items = rows.map((row) => {
    const priceCents = row.price_cents;
    const quantity = row.quantity;
    const product = {
      id: String(row.product_id),
      name: row.name,
      description: row.description,
      priceCents,
      imageUrl: row.image_url,
      category: row.category,
      stock: row.stock_count,
      slug: row.slug,
      salesCount: row.sales_count,
    };
    return {
      productId: String(row.product_id),
      product,
      quantity,
      lineTotalCents: priceCents * quantity,
    };
  });

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: cartId,
    items,
    subtotalCents,
    totalItems,
  };
}

/** Add a product to a cart. Upserts quantity if product already in cart. Returns updated cart. */
export function addItemToCart(
  cartId: string,
  productId: string,
): CartResult | 'CART_NOT_FOUND' | 'PRODUCT_NOT_FOUND' {
  const db = getDb();
  if (!cartExists(cartId)) return 'CART_NOT_FOUND';

  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return 'PRODUCT_NOT_FOUND';

  db.prepare(
    `
    INSERT INTO cart_line_items (cart_id, product_id, quantity)
    VALUES (?, ?, 1)
    ON CONFLICT(cart_id, product_id) DO UPDATE SET quantity = quantity + 1
  `,
  ).run(cartId, productId);

  // Update cart timestamp
  db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(cartId);

  return getCart(cartId) ?? 'CART_NOT_FOUND';
}

/** Update the quantity of a cart line item. If quantity is 0, the item is removed. Returns updated cart. */
export function updateCartItem(
  cartId: string,
  productId: string,
  quantity: number,
): CartResult | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART' {
  const db = getDb();
  if (!cartExists(cartId)) return 'CART_NOT_FOUND';

  if (quantity === 0) {
    const result = db
      .prepare('DELETE FROM cart_line_items WHERE cart_id = ? AND product_id = ?')
      .run(cartId, productId);
    if (result.changes === 0) return 'PRODUCT_NOT_IN_CART';
  } else {
    const result = db
      .prepare('UPDATE cart_line_items SET quantity = ? WHERE cart_id = ? AND product_id = ?')
      .run(quantity, cartId, productId);
    if (result.changes === 0) return 'PRODUCT_NOT_IN_CART';
  }

  db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(cartId);
  return getCart(cartId) ?? 'CART_NOT_FOUND';
}

/** Remove an item from the cart. Returns updated cart. */
export function removeCartItem(
  cartId: string,
  productId: string,
): CartResult | 'CART_NOT_FOUND' | 'PRODUCT_NOT_IN_CART' {
  const db = getDb();
  if (!cartExists(cartId)) return 'CART_NOT_FOUND';

  const result = db
    .prepare('DELETE FROM cart_line_items WHERE cart_id = ? AND product_id = ?')
    .run(cartId, productId);
  if (result.changes === 0) return 'PRODUCT_NOT_IN_CART';

  db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(cartId);
  return getCart(cartId) ?? 'CART_NOT_FOUND';
}
