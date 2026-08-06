import { type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { ErrorResponse } from '@shop/contracts/common';
import type { Country } from '@shop/contracts/country';

/**
 * Core fetch wrapper for the Shop Qarefully API.
 * Includes credentials (cookies) on every request.
 * All feature modules should use this as their base.
 */

let activeCountry: Country | null = null;

/** Keeps the request country aligned with the mounted country provider. */
export function setActiveApiCountry(country: Country | null): void {
  activeCountry = country;
}

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

export class ApiContractError extends Error {
  readonly path: string;
  readonly validationSummary: string;

  constructor(path: string, validationSummary: string) {
    super(`Response contract violation for ${path}: ${validationSummary}`);
    this.name = 'ApiContractError';
    this.path = path;
    this.validationSummary = validationSummary;
  }
}

export function isMissingCartError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404 && error.message === 'Cart not found';
}

/**
 * Core fetch function. Sends credentials with every request.
 * All feature API modules delegate to this.
 */
async function fetchWithResponseSchema<T extends TSchema>(
  schema: T,
  path: string,
  options?: RequestInit,
): Promise<Static<T>> {
  const mergedHeaders = new Headers(options?.headers);
  if (activeCountry !== null) {
    mergedHeaders.set('x-shop-country', activeCountry);
  }
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
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiContractError(path, 'successful response did not contain valid JSON');
  }
  if (!Value.Check(schema, body)) {
    const error = [...Value.Errors(schema, body)][0];
    const summary = error ? `${error.path || '/'}: ${error.message}` : 'schema validation failed';
    throw new ApiContractError(path, summary);
  }
  return body;
}

export { fetchWithResponseSchema as apiFetch };
