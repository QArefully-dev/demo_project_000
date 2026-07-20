import type {
  PowderizerConfigResponse,
  PowderMixQuote,
  CreatePowderMixBody,
} from '@shop/contracts/powderizer';
import {
  PowderizerConfigResponse as PowderizerConfigSchema,
  PowderMixQuote as PowderMixQuoteSchema,
} from '@shop/contracts/powderizer';
import { apiFetch } from './client';
import {
  createPowderMix,
  updatePowderMix,
  requotePowderMix,
  updatePowderMixQuantity,
  removePowderMix,
} from './powderizer';

export function getCustomPowderConfig(signal?: AbortSignal): Promise<PowderizerConfigResponse> {
  return apiFetch(PowderizerConfigSchema, '/api/custom-powder/config', { signal });
}

export function quoteCustomPowderMix(
  body: CreatePowderMixBody,
  signal?: AbortSignal,
): Promise<PowderMixQuote> {
  return apiFetch(PowderMixQuoteSchema, '/api/custom-powder/quote', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

export const createCustomPowderMix = createPowderMix;
export const updateCustomPowderMix = updatePowderMix;
export const requoteCustomPowderMix = requotePowderMix;
export const updateCustomPowderMixQuantity = updatePowderMixQuantity;
export const removeCustomPowderMix = removePowderMix;
