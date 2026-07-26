import { Link } from 'react-router-dom';
import type { CustomBlendOption } from '@shop/contracts/custom-blends';
import { Button } from '@/components/ui/button';
import { CUSTOM_BLEND_MADE_TO_ORDER_NOTE } from './CustomBlendPackaging';
import { CustomBlendPreview, type PreviewIngredient } from './CustomBlendPreview';

export function SuccessRecap({
  result,
  base,
  basePercentage,
  ingredients,
  authoritativeConfigKey,
}: {
  result: 'created' | 'replaced';
  base: CustomBlendOption;
  basePercentage: number;
  ingredients: readonly PreviewIngredient[];
  /** Present only when the completed operation returned a new server-issued key. */
  authoritativeConfigKey?: string;
}) {
  return (
    <div className="content-shell grid max-w-3xl gap-6 pb-12">
      <header>
        <p className="custom-blend-eyebrow-rule section-eyebrow">Custom Blend</p>
        <h1 className="section-heading mt-2">
          {result === 'created' ? 'Custom blend added to your cart' : 'Custom blend updated'}
        </h1>
      </header>
      <CustomBlendPreview
        base={base}
        basePercentage={basePercentage}
        ingredients={ingredients}
        authoritativeConfigKey={authoritativeConfigKey}
      />
      <section
        aria-labelledby="blend-recap-heading"
        className="custom-blend-surface rounded-xl p-4"
      >
        <h2 id="blend-recap-heading" className="font-semibold">
          Blend recap
        </h2>
        <p className="mt-2 text-sm">
          {basePercentage}% {base.productName}
        </p>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {ingredients.map(({ option, percentage }) => (
            <li key={option.variant.variantId}>
              {percentage}% {option.productName}
            </li>
          ))}
        </ul>
      </section>
      <p className="custom-blend-notice rounded-xl p-3 text-sm">
        {CUSTOM_BLEND_MADE_TO_ORDER_NOTE}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link to="/cart" />}>
          View cart
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link to="/catalog" />}>
          Keep shopping
        </Button>
      </div>
    </div>
  );
}
