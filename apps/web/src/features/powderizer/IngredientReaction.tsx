import type { Product } from '@shop/contracts/products';
import { selectIngredientReaction } from './powderizerCopy';
import type { BuilderComponent } from './powderizerState';

type IngredientReactionProps = {
  components: readonly BuilderComponent[];
  products: readonly Product[];
};

export function IngredientReaction({ components, products }: IngredientReactionProps) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const reaction = selectIngredientReaction(
    components.flatMap((component) => productsById.get(component.productId)?.slug ?? []),
  );
  if (!reaction) return null;
  return (
    <p className="powderizer-reaction" role="status">
      {reaction}
    </p>
  );
}
