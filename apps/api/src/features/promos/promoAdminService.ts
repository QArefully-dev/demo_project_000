import { CATALOG_CATEGORIES, isUtcIsoInstant, type CatalogCategory } from '@shop/catalog';
import type { UnitOfWork } from '../../db/unitOfWork.js';
import type { AuditContext } from '../audit/auditEvent.js';
import type { AuditWriter } from '../audit/auditService.js';
import type { PromoRecord } from './promoRepository.js';
import type { PromoAdminRepository, PromoAdminWrite } from './promoAdminRepository.js';

const categorySet = new Set<string>(CATALOG_CATEGORIES);

export class PromoAdminServiceError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'DUPLICATE' | 'INVALID_INPUT' | 'ACTIVE_RESERVATIONS',
    message: string,
  ) {
    super(message);
    this.name = 'PromoAdminServiceError';
  }
}

export type PromoAdminCreateInput = PromoAdminWrite;
export type PromoAdminUpdateInput = Omit<PromoAdminWrite, 'code'>;

export interface PromoAdminService {
  listAdmin(query?: { code?: string; active?: boolean }): PromoRecord[];
  get(code: string): PromoRecord;
  create(input: PromoAdminCreateInput, context: AuditContext): PromoRecord;
  update(code: string, input: PromoAdminUpdateInput, context: AuditContext): PromoRecord;
  deactivate(code: string, context: AuditContext, options?: { force?: boolean }): PromoRecord;
}

function requireCode(code: unknown): string {
  if (typeof code !== 'string' || code.length === 0 || code.length > 64) {
    throw new PromoAdminServiceError(
      'INVALID_INPUT',
      'code must be a non-empty string of at most 64 characters',
    );
  }
  return code;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new PromoAdminServiceError(
      'INVALID_INPUT',
      `${field} must be a non-negative safe integer`,
    );
  }
  return value as number;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new PromoAdminServiceError('INVALID_INPUT', `${field} must be a positive safe integer`);
  }
  return value as number;
}

function nullableNonNegativeInteger(value: unknown, field: string): number | null {
  return value === null ? null : requireNonNegativeInteger(value, field);
}

function nullablePositiveInteger(value: unknown, field: string): number | null {
  return value === null ? null : requirePositiveInteger(value, field);
}

function nullableInstant(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !isUtcIsoInstant(value)) {
    throw new PromoAdminServiceError(
      'INVALID_INPUT',
      `${field} must be an ISO UTC instant or null`,
    );
  }
  return value;
}

function nullableCategory(value: unknown): CatalogCategory | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !categorySet.has(value)) {
    throw new PromoAdminServiceError(
      'INVALID_INPUT',
      'categoryScope must be a catalog category or null',
    );
  }
  return value as CatalogCategory;
}

function normalizeWrite(input: PromoAdminWrite, includeCode: true): PromoAdminCreateInput;
function normalizeWrite(input: PromoAdminUpdateInput, includeCode: false): PromoAdminUpdateInput;
function normalizeWrite(
  input: PromoAdminCreateInput | PromoAdminUpdateInput,
  includeCode: boolean,
): PromoAdminCreateInput | PromoAdminUpdateInput {
  if (input.kind !== 'percent' && input.kind !== 'fixed') {
    throw new PromoAdminServiceError('INVALID_INPUT', 'kind must be percent or fixed');
  }
  const discountPercent = requireNonNegativeInteger(input.discountPercent, 'discountPercent');
  const amountCents = nullablePositiveInteger(input.amountCents, 'amountCents');
  if (input.kind === 'percent' && (discountPercent < 1 || discountPercent > 100)) {
    throw new PromoAdminServiceError(
      'INVALID_INPUT',
      'discountPercent must be an integer between 1 and 100 for percent promos',
    );
  }
  if (input.kind === 'fixed' && amountCents === null) {
    throw new PromoAdminServiceError('INVALID_INPUT', 'amountCents is required for fixed promos');
  }
  const startAt = nullableInstant(input.startAt, 'startAt');
  const endAt = nullableInstant(input.endAt, 'endAt');
  if (startAt !== null && endAt !== null && startAt >= endAt) {
    throw new PromoAdminServiceError('INVALID_INPUT', 'startAt must be before endAt');
  }
  const normalized = {
    discountPercent,
    minItemCount: requireNonNegativeInteger(input.minItemCount, 'minItemCount'),
    kind: input.kind,
    amountCents,
    minSubtotalCents: nullableNonNegativeInteger(input.minSubtotalCents, 'minSubtotalCents'),
    categoryScope: nullableCategory(input.categoryScope),
    startAt,
    endAt,
    maxRedemptions: nullableNonNegativeInteger(input.maxRedemptions, 'maxRedemptions'),
    perUserLimit: nullablePositiveInteger(input.perUserLimit, 'perUserLimit'),
  } as const;
  return includeCode
    ? { code: requireCode((input as PromoAdminCreateInput).code), ...normalized }
    : normalized;
}

function requirePromo(repository: PromoAdminRepository, code: string): PromoRecord {
  const promo = repository.get(code);
  if (!promo) throw new PromoAdminServiceError('NOT_FOUND', 'Promo code not found');
  return promo;
}

export function createPromoAdminService(dependencies: {
  repository: PromoAdminRepository;
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}): PromoAdminService {
  const { repository, unitOfWork, audit } = dependencies;
  return {
    listAdmin(query = {}) {
      return repository.list(query);
    },
    get(code) {
      return requirePromo(repository, requireCode(code));
    },
    create(input, context) {
      const normalized = normalizeWrite(input, true);
      return unitOfWork.run(() => {
        if (repository.get(normalized.code))
          throw new PromoAdminServiceError('DUPLICATE', 'Promo code already exists');
        const promo = repository.create(normalized);
        audit.append({ action: 'promo.created', context, promoCode: promo.code });
        return promo;
      });
    },
    update(code, input, context) {
      const promoCode = requireCode(code);
      const normalized = normalizeWrite(input, false);
      return unitOfWork.run(() => {
        const existing = requirePromo(repository, promoCode);
        const activeReservations = repository.activeReservationCount(promoCode);
        if (
          normalized.maxRedemptions !== null &&
          normalized.maxRedemptions < existing.redemptionCount + activeReservations
        ) {
          throw new PromoAdminServiceError(
            'INVALID_INPUT',
            'maxRedemptions must be at least the current redemption count plus active reservations',
          );
        }
        const promo = repository.update(promoCode, normalized);
        if (!promo) throw new PromoAdminServiceError('NOT_FOUND', 'Promo code not found');
        audit.append({ action: 'promo.updated', context, promoCode: promo.code });
        return promo;
      });
    },
    deactivate(code, context, options = {}) {
      const promoCode = requireCode(code);
      return unitOfWork.run(() => {
        requirePromo(repository, promoCode);
        if (!options.force && repository.activeReservationCount(promoCode) > 0) {
          throw new PromoAdminServiceError(
            'ACTIVE_RESERVATIONS',
            'Promo code has active reservations; force is required to deactivate it',
          );
        }
        const promo = repository.deactivate(promoCode);
        if (!promo) throw new PromoAdminServiceError('NOT_FOUND', 'Promo code not found');
        audit.append({ action: 'promo.deactivated', context, promoCode: promo.code });
        return promo;
      });
    },
  };
}
