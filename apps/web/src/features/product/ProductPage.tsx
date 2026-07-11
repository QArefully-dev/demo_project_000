/**
 * Product detail page — placeholder (Wave 0).
 * Full implementation deferred to W1.B.
 */
import { useParams } from 'react-router-dom';

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="text-2xl font-bold">Product Detail</h1>
      <p className="mt-2 text-muted-foreground">
        Product page for ID: {id}. This will show full product details, stock, cart action, and related products.
      </p>
    </div>
  );
}
