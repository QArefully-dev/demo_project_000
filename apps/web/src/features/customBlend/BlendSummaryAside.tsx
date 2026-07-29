import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CustomBlendPreview, type PreviewIngredient } from './CustomBlendPreview';
import type { CustomBlendOption } from '@shop/contracts/custom-blends';
import { MixVisualization } from './MixVisualization';
import { RatioGauge } from './RatioGauge';
import type { MixPart } from './MixVisualization';

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
  errors: readonly string[];
  isEditing: boolean;
  isValid: boolean;
  isCartAvailable: boolean;
  isSubmitting: boolean;
  mixBase: MixPart;
  mixIngredients: readonly MixPart[];
  previewIngredients: readonly PreviewIngredient[];
  configKey?: string;
}) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <Card className="custom-blend-surface">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">4. Review</p>
          <CardTitle>Review your blend</CardTitle>
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
                <li key={error} className="text-sm text-destructive">
                  {error}
                </li>
              ))}
            </ul>
          )}
          <Button type="submit" disabled={!isValid || !isCartAvailable || isSubmitting}>
            {isEditing ? 'Update blend' : 'Add blend to cart'}
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}
