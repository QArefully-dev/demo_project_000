import type {
  CustomBlendIngredientInput,
  CustomBlendSnapshot,
} from '@shop/contracts/custom-blends';

/**
 * Configurator draft state and derived blend facts.
 *
 * These rules mirror the server's `normalizeCustomBlendSpec` so the customer sees a
 * boundary before submitting. They never replace it: the backend re-validates and
 * re-resolves every fact at mutation time.
 */

export const MIN_INGREDIENTS = 1;
export const MAX_INGREDIENTS = 4;
export const MIN_INGREDIENT_PERCENTAGE = 5;
export const MAX_INGREDIENT_PERCENTAGE = 50;
export const MAX_INGREDIENT_TOTAL = 50;
export const MIN_BASE_PERCENTAGE = 50;
export const MAX_BASE_PERCENTAGE = 95;

export type CustomBlendDraftIngredient = {
  variantId: number;
  percentage: number;
};

export type CustomBlendState = {
  baseVariantId: number | null;
  /**
   * Config key of the cart line being edited, or `null` when configuring a new line.
   *
   * Only `edit-loaded` sets it, so a non-null value proves the draft was hydrated from that
   * exact line; `target-changed` clears it the moment the URL stops naming that target. It is
   * therefore never a stale mirror of the URL, and edit mode is derived from it rather than
   * stored as a separate lock flag.
   */
  editConfigKey: string | null;
  /** Server-owned quantity of the edited line, shown read-only. `null` when creating. */
  lockedQuantity: number | null;
  ingredients: CustomBlendDraftIngredient[];
};

export const initialCustomBlendState: CustomBlendState = {
  baseVariantId: null,
  editConfigKey: null,
  lockedQuantity: null,
  ingredients: [],
};

export type CustomBlendEvent =
  /**
   * The URL now names this configurator target. The URL owns the target, so any divergence
   * discards the draft rather than reconciling it.
   */
  | { type: 'target-changed'; baseVariantId: number | null; editConfigKey: string | null }
  | {
      type: 'edit-loaded';
      baseVariantId: number;
      configKey: string;
      quantity: number;
      ingredients: readonly CustomBlendDraftIngredient[];
    }
  | { type: 'ingredient-toggled'; variantId: number }
  | { type: 'ingredient-removed'; variantId: number }
  | { type: 'percentage-changed'; variantId: number; percentage: number };

/** Default share for a newly picked ingredient: fill the remaining budget, within bounds. */
function defaultPercentageFor(state: CustomBlendState): number {
  const remaining = MAX_INGREDIENT_TOTAL - ingredientTotalPercentage(state);
  return Math.max(MIN_INGREDIENT_PERCENTAGE, Math.min(MAX_INGREDIENT_PERCENTAGE, remaining));
}

export function customBlendReducer(
  state: CustomBlendState,
  event: CustomBlendEvent,
): CustomBlendState {
  switch (event.type) {
    case 'target-changed': {
      // A hydrated edit draft belongs to one URL target. It survives only while the URL still
      // names that target: same base lot and same config key. Anything else — base changed,
      // config key changed, edit mode left — discards the draft, because ingredient
      // compatibility and the replace target are both resolved against the base lot.
      const isSameTarget =
        state.baseVariantId === event.baseVariantId &&
        (state.editConfigKey === null || state.editConfigKey === event.editConfigKey);
      if (isSameTarget) return state;
      return { ...initialCustomBlendState, baseVariantId: event.baseVariantId };
    }
    case 'edit-loaded':
      return {
        baseVariantId: event.baseVariantId,
        editConfigKey: event.configKey,
        lockedQuantity: event.quantity,
        ingredients: event.ingredients.map((ingredient) => ({ ...ingredient })),
      };
    case 'ingredient-toggled': {
      const existing = state.ingredients.find(
        (ingredient) => ingredient.variantId === event.variantId,
      );
      if (existing) {
        return {
          ...state,
          ingredients: state.ingredients.filter(
            (ingredient) => ingredient.variantId !== event.variantId,
          ),
        };
      }
      if (state.ingredients.length >= MAX_INGREDIENTS) return state;
      return {
        ...state,
        ingredients: [
          ...state.ingredients,
          { variantId: event.variantId, percentage: defaultPercentageFor(state) },
        ],
      };
    }
    case 'ingredient-removed':
      return {
        ...state,
        ingredients: state.ingredients.filter(
          (ingredient) => ingredient.variantId !== event.variantId,
        ),
      };
    case 'percentage-changed':
      return {
        ...state,
        ingredients: state.ingredients.map((ingredient) =>
          ingredient.variantId === event.variantId
            ? { ...ingredient, percentage: event.percentage }
            : ingredient,
        ),
      };
  }
}

export function ingredientTotalPercentage(state: CustomBlendState): number {
  return state.ingredients.reduce((total, ingredient) => total + ingredient.percentage, 0);
}

/** Live remainder held by the base lot. Derived only; never stored. */
export function derivedBasePercentage(state: CustomBlendState): number {
  return 100 - ingredientTotalPercentage(state);
}

export function isIngredientSelected(state: CustomBlendState, variantId: number): boolean {
  return state.ingredients.some((ingredient) => ingredient.variantId === variantId);
}

/** True once no further ingredient may be picked, used to disable rather than hide options. */
export function isIngredientLimitReached(state: CustomBlendState): boolean {
  return state.ingredients.length >= MAX_INGREDIENTS;
}

export type CustomBlendValidation = {
  isValid: boolean;
  errors: string[];
};

function isWholePercentageInRange(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_INGREDIENT_PERCENTAGE &&
    value <= MAX_INGREDIENT_PERCENTAGE
  );
}

/** Customer-facing mirror of the server blend rules. Messages are exact and deterministic. */
export function customBlendValidation(state: CustomBlendState): CustomBlendValidation {
  const errors: string[] = [];

  if (state.baseVariantId === null) {
    errors.push('Choose a base material to start your blend.');
  }
  if (state.ingredients.length < MIN_INGREDIENTS) {
    errors.push('Add at least 1 ingredient.');
  }
  if (state.ingredients.length > MAX_INGREDIENTS) {
    errors.push('Use no more than 4 ingredients.');
  }
  if (state.ingredients.some((ingredient) => !isWholePercentageInRange(ingredient.percentage))) {
    errors.push('Each ingredient must be a whole percentage between 5% and 50%.');
  }

  const total = ingredientTotalPercentage(state);
  if (total > MAX_INGREDIENT_TOTAL) {
    errors.push(`Ingredients must total 50% or less. They currently total ${total}%.`);
  }

  const basePercentage = derivedBasePercentage(state);
  if (
    errors.length === 0 &&
    (basePercentage < MIN_BASE_PERCENTAGE || basePercentage > MAX_BASE_PERCENTAGE)
  ) {
    errors.push(`The base must stay between 50% and 95%. It is currently ${basePercentage}%.`);
  }

  return { isValid: errors.length === 0, errors };
}

/** Ingredient inputs in request shape. Canonical ordering stays a server concern. */
export function toIngredientInputs(state: CustomBlendState): CustomBlendIngredientInput[] {
  return state.ingredients.map((ingredient) => ({
    variantId: ingredient.variantId,
    percentage: ingredient.percentage,
  }));
}

/** Rehydrates a draft from a persisted line specification for editing. */
export function snapshotToDraftIngredients(
  snapshot: CustomBlendSnapshot,
): CustomBlendDraftIngredient[] {
  return snapshot.ingredients.map((ingredient) => ({
    variantId: ingredient.variantId,
    percentage: ingredient.percentage,
  }));
}
