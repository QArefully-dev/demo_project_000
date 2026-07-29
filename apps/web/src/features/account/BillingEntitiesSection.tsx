import { useState } from 'react';
import { formatPostalAddress } from '@shop/contracts/address';
import type {
  BillingEntity,
  CreateBillingEntityBody,
  UpdateBillingEntityBody,
} from '@shop/contracts/trade-account';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import {
  EMPTY_POSTAL_ADDRESS_DRAFT,
  PostalAddressFields,
  toPostalAddressDraft,
  validatePostalAddressDraft,
  type PostalAddressDraft,
  type PostalAddressFieldErrors,
} from './PostalAddressFields';
import { TradeCheckbox, TradeListStatus, TradeTextField } from './TradeFormFields';
import {
  TRADE_FIELD_BOUNDS,
  checkOptionalTradeText,
  checkRequiredTradeText,
} from './tradeFieldValidation';
import type { UseTradeProfileResult } from './useTradeProfile';

/**
 * `Billing details` account section — the buyer's saved invoice parties.
 * Create, edit, set default, and retire. Mirrors `DeliverySitesSection` so the two trade
 * collections behave identically; the server stays authoritative for defaults and retirement.
 */

interface EntityDraft {
  legalName: string;
  registrationNumber: string;
  vatNumber: string;
  address: PostalAddressDraft;
  isDefault: boolean;
}

interface EntityDraftErrors {
  legalName?: string;
  registrationNumber?: string;
  vatNumber?: string;
  address?: PostalAddressFieldErrors;
}

const EMPTY_ENTITY_DRAFT: EntityDraft = {
  legalName: '',
  registrationNumber: '',
  vatNumber: '',
  address: EMPTY_POSTAL_ADDRESS_DRAFT,
  isDefault: false,
};

function draftFromEntity(entity: BillingEntity): EntityDraft {
  return {
    legalName: entity.legalName,
    registrationNumber: entity.registrationNumber ?? '',
    vatNumber: entity.vatNumber ?? '',
    address: toPostalAddressDraft(entity.address),
    isDefault: entity.isDefault,
  };
}

type EntityValidation =
  { ok: true; body: CreateBillingEntityBody } | { ok: false; errors: EntityDraftErrors };

/**
 * Validates a draft and builds the request body. Blank optional identifiers are omitted rather
 * than sent as empty strings, which the contract rejects.
 */
function validateEntityDraft(draft: EntityDraft): EntityValidation {
  const errors: EntityDraftErrors = {};
  const legalNameError = checkRequiredTradeText(
    draft.legalName,
    'Registered company name',
    TRADE_FIELD_BOUNDS.legalName,
  );
  if (legalNameError) errors.legalName = legalNameError;
  const registrationError = checkOptionalTradeText(
    draft.registrationNumber,
    'Company registration number',
    TRADE_FIELD_BOUNDS.registrationNumber,
  );
  if (registrationError) errors.registrationNumber = registrationError;
  const vatError = checkOptionalTradeText(
    draft.vatNumber,
    'VAT number',
    TRADE_FIELD_BOUNDS.vatNumber,
  );
  if (vatError) errors.vatNumber = vatError;

  const address = validatePostalAddressDraft(draft.address);
  if (!address.ok) errors.address = address.errors;

  if (Object.keys(errors).length > 0 || !address.ok) {
    return { ok: false, errors };
  }

  const body: CreateBillingEntityBody = {
    legalName: draft.legalName.trim(),
    address: address.address,
    isDefault: draft.isDefault,
  };
  const registrationNumber = draft.registrationNumber.trim();
  if (registrationNumber) body.registrationNumber = registrationNumber;
  const vatNumber = draft.vatNumber.trim();
  if (vatNumber) body.vatNumber = vatNumber;
  return { ok: true, body };
}

/**
 * Create body -> edit patch. The edit form always renders both identifier fields prefilled from the
 * saved entity, so an identifier missing from the validated body means the buyer cleared it. Sending
 * explicit `null` clears the stored value; omitting it would read as "no change" on the server and
 * the cleared field would silently survive while the form reported success.
 */
function toUpdateBody(body: CreateBillingEntityBody): UpdateBillingEntityBody {
  return {
    ...body,
    registrationNumber: body.registrationNumber ?? null,
    vatNumber: body.vatNumber ?? null,
  };
}

interface EntityFormProps {
  idPrefix: string;
  initialDraft: EntityDraft;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (body: CreateBillingEntityBody) => Promise<void>;
}

function BillingEntityForm({
  idPrefix,
  initialDraft,
  submitLabel,
  onCancel,
  onSubmit,
}: EntityFormProps) {
  const [draft, setDraft] = useState<EntityDraft>(initialDraft);
  const [errors, setErrors] = useState<EntityDraftErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    const result = validateEntityDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.body);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save billing details');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-lg bg-muted/40 p-4"
    >
      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}
      <TradeTextField
        id={`${idPrefix}-legalName`}
        label="Registered company name"
        value={draft.legalName}
        onChange={(legalName) => setDraft({ ...draft, legalName })}
        error={errors.legalName}
        maxLength={TRADE_FIELD_BOUNDS.legalName}
        autoComplete="organization"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TradeTextField
          id={`${idPrefix}-registrationNumber`}
          label="Company registration number"
          value={draft.registrationNumber}
          onChange={(registrationNumber) => setDraft({ ...draft, registrationNumber })}
          error={errors.registrationNumber}
          maxLength={TRADE_FIELD_BOUNDS.registrationNumber}
          optional
        />
        <TradeTextField
          id={`${idPrefix}-vatNumber`}
          label="VAT number"
          value={draft.vatNumber}
          onChange={(vatNumber) => setDraft({ ...draft, vatNumber })}
          error={errors.vatNumber}
          maxLength={TRADE_FIELD_BOUNDS.vatNumber}
          optional
        />
      </div>
      <PostalAddressFields
        idPrefix={idPrefix}
        legend="Billing address"
        value={draft.address}
        errors={errors.address}
        onChange={(address) => setDraft({ ...draft, address })}
      />
      <TradeCheckbox
        id={`${idPrefix}-isDefault`}
        label="Use as my default billing details"
        checked={draft.isDefault}
        onChange={(isDefault) => setDraft({ ...draft, isDefault })}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Renders the identifiers a buyer saved, or nothing when both are absent. */
function identifierLine(entity: BillingEntity): string | null {
  const parts: string[] = [];
  if (entity.registrationNumber) parts.push(`Company no. ${entity.registrationNumber}`);
  if (entity.vatNumber) parts.push(`VAT ${entity.vatNumber}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

interface BillingEntitiesSectionProps {
  profile: UseTradeProfileResult;
}

export function BillingEntitiesSection({ profile }: BillingEntitiesSectionProps) {
  const { billingEntities } = profile;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeEntities = billingEntities.items.filter((entity) => entity.active);

  async function runRowAction(entityId: string, action: () => Promise<void>) {
    setRowError(null);
    setBusyId(entityId);
    try {
      await action();
    } catch (error) {
      setRowError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="billing-details-heading" className="mt-6 rounded-lg border p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="billing-details-heading"
            className="flex items-center gap-2 text-base font-medium"
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Billing details
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Companies we invoice. Pick one at checkout.
          </p>
        </div>
        {!adding && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            Add billing details
          </Button>
        )}
      </div>

      {adding && (
        <div className="mt-4">
          <BillingEntityForm
            idPrefix="new-entity"
            initialDraft={EMPTY_ENTITY_DRAFT}
            submitLabel="Save billing details"
            onCancel={() => setAdding(false)}
            onSubmit={async (body) => {
              await profile.addBillingEntity(body);
              setAdding(false);
            }}
          />
        </div>
      )}

      <TradeListStatus
        loading={billingEntities.loading}
        error={billingEntities.error}
        onRetry={profile.reloadBillingEntities}
        isEmpty={activeEntities.length === 0}
        loadingLabel="Loading billing details…"
        emptyLabel="No billing details saved yet."
      />

      {rowError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {rowError}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {activeEntities.map((entity) => {
          const identifiers = identifierLine(entity);
          return (
            <li key={entity.id} className="rounded-lg border p-4">
              {editingId === entity.id ? (
                <BillingEntityForm
                  idPrefix={`entity-${entity.id}`}
                  initialDraft={draftFromEntity(entity)}
                  submitLabel="Save changes"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (body) => {
                    await profile.editBillingEntity(entity.id, toUpdateBody(body));
                    setEditingId(null);
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entity.legalName}</span>
                      {entity.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                    {identifiers && (
                      <p className="mt-1 text-sm text-muted-foreground">{identifiers}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {formatPostalAddress(entity.address)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!entity.isDefault && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === entity.id}
                        onClick={() =>
                          void runRowAction(entity.id, () =>
                            profile.setDefaultBillingEntity(entity.id),
                          )
                        }
                      >
                        Set as default
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(entity.id)}
                    >
                      Edit {entity.legalName}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === entity.id}
                      onClick={() =>
                        void runRowAction(entity.id, () => profile.retireEntity(entity.id))
                      }
                    >
                      Remove {entity.legalName}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
