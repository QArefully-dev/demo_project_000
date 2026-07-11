import type { ErrorResponse } from '@shop/contracts';

/**
 * Core fetch wrapper for the Shop Qarefully API.
 * Includes credentials (cookies) on every request.
 * All feature modules should use this as their base.
 */

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

/**
 * Core fetch function. Sends credentials with every request.
 * All feature API modules delegate to this.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const mergedHeaders = new Headers(options?.headers);
  if (options?.body && typeof options.body === 'string') {
    mergedHeaders.set('Content-Type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers: mergedHeaders,
      credentials: 'include',
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
