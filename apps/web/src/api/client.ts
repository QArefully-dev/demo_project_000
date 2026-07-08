import type {
  AddToCartBody,
  Cart,
  CreateCartResponse,
  ErrorResponse,
  OrderDetailResponse,
  PlaceOrderBody,
  PlaceOrderResponse,
  ProductListResponse,
  UpdateCartLineBody,
  ValidatePromoBody,
  ValidatePromoResponse,
} from '@shop/contracts';

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  );
}

export class ApiError extends Error {
  readonly status: number | null;
  readonly response: ErrorResponse | null;

  constructor(message: string, status: number | null, response: ErrorResponse | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }

  get isNetworkError(): boolean {
    return this.status === null;
  }
}

export function isMissingCartError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404 && error.message === 'Cart not found';
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const mergedHeaders = new Headers(options?.headers);
  if (options?.body && typeof options.body === 'string') {
    mergedHeaders.set('Content-Type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers: mergedHeaders,
    });
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : 'Unable to reach the server', null);
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const errorResponse = isErrorResponse(body) ? body : null;
    throw new ApiError(
      errorResponse?.error ?? `Request failed: ${res.status}`,
      res.status,
      errorResponse,
    );
  }
  return res.json() as Promise<T>;
}

export function getProducts(): Promise<ProductListResponse> {
  return apiFetch<ProductListResponse>('/api/products');
}

export function createCart(): Promise<CreateCartResponse> {
  return apiFetch<CreateCartResponse>('/api/cart', { method: 'POST' });
}

export function getCart(cartId: string): Promise<Cart> {
  return apiFetch<Cart>(`/api/cart/${cartId}`);
}

export function addToCart(cartId: string, productId: string): Promise<Cart> {
  const body: AddToCartBody = { productId };
  return apiFetch<Cart>(`/api/cart/${cartId}/items`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCartItem(cartId: string, productId: string, quantity: number): Promise<Cart> {
  const body: UpdateCartLineBody = { productId, quantity };
  return apiFetch<Cart>(`/api/cart/${cartId}/items`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function removeFromCart(cartId: string, productId: string): Promise<Cart> {
  return apiFetch<Cart>(`/api/cart/${cartId}/items/${productId}`, {
    method: 'DELETE',
  });
}

export function validatePromo(cartId: string, promoCode: string): Promise<ValidatePromoResponse> {
  const body: ValidatePromoBody = { cartId, promoCode };
  return apiFetch<ValidatePromoResponse>('/api/promo/validate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function placeOrder(body: PlaceOrderBody): Promise<PlaceOrderResponse> {
  return apiFetch<PlaceOrderResponse>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getOrder(orderId: string): Promise<OrderDetailResponse> {
  return apiFetch<OrderDetailResponse>(`/api/orders/${orderId}`);
}
