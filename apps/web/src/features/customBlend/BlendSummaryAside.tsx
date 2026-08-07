import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CustomBlendPreview, type PreviewIngredient } from './CustomBlendPreview';
import type { CustomBlendOption } from '@shop/contracts/custom-blends';
import { MixVisualization } from './MixVisualization';
import { RatioGauge } from './RatioGauge';
import type { MixPart } from './MixVisualization';
import type { CustomBlendMessage } from './customBlendState';
import { useLocalisation } from '@/i18n/LocaleContext';
import { customBlendMessages } from '@shop/localisation/messages/customBlend';

export function BlendSummaryAside({
  base,
  basePercentage,
  totalPercentage,
  ingredientCount,
  errors,
  isEditing,
  isValid,
  isCartAvailable,
  isSubmitting,
  mixBase,
  mixIngredients,
  previewIngredients,
  configKey,
}: {
  base: CustomBlendOption;
  basePercentage: number;
  totalPercentage: number;
  ingredientCount: number;
  errors: readonly CustomBlendMessage[];
  isEditing: boolean;
  isValid: boolean;
  isCartAvailable: boolean;
  isSubmitting: boolean;
  mixBase: MixPart;
  mixIngredients: readonly MixPart[];
  previewIngredients: readonly PreviewIngredient[];
  configKey?: string;
}) {
  const { translate, formatNumber } = useLocalisation();
  const renderValidationError = (error: CustomBlendMessage) => {
    const params = { ...(error.params ?? {}) } as Record<string, string | number | bigint>;
    for (const [name, value] of Object.entries(error.params ?? {})) {
      if (typeof value === 'number') params[`${name}Label`] = formatNumber(value);
    }
    return translate(customBlendMessages, error.key, params);
  };
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <Card className="custom-blend-surface">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">
            {translate(customBlendMessages, 'customBlend.reviewStep')}
          </p>
          <CardTitle>{translate(customBlendMessages, 'customBlend.reviewTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <CustomBlendPreview
            base={base}
            basePercentage={basePercentage}
            ingredients={previewIngredients}
            configKey={configKey}
          />
          <Separator />
          <RatioGauge
            basePercentage={basePercentage}
            totalPercentage={totalPercentage}
            ingredientCount={ingredientCount}
            isValid={isValid}
          />
          <MixVisualization base={mixBase} ingredients={mixIngredients} />
          {errors.length > 0 && (
            <ul className="grid gap-1" role="alert">
              {errors.map((error) => (
                <li
                  key={`${error.key}:${JSON.stringify(error.params ?? {})}`}
                  className="text-sm text-destructive"
                >
                  {renderValidationError(error)}
                </li>
              ))}
            </ul>
          )}
          <Button type="submit" disabled={!isValid || !isCartAvailable || isSubmitting}>
            {translate(
              customBlendMessages,
              isEditing ? 'customBlend.update' : 'customBlend.addToCart',
            )}
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}
