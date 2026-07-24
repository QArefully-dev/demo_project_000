import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Static work-in-progress placeholder that replaced the former "Custom Powder" blend builder.
 *
 * The blend-builder UI has been removed while Custom Small Order is
 * redesigned for pallet-scale ordering. This page performs no API calls and
 * exposes no interactive controls beyond navigation back to the catalogue;
 * existing custom-mix cart/order lines keep rendering elsewhere and still
 * deep-link here for editing, so the notice says so explicitly.
 */
export function CustomSmallOrderPage() {
  return (
    <div className="content-shell py-16">
      <Card className="mx-auto max-w-xl text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            <h1>Custom Small Order</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">
            This feature is being rebuilt. Mix editing is unavailable while we redesign Custom Small
            Order for pallet-scale ordering.
          </p>
          <p className="text-sm text-muted-foreground">
            Any existing custom mix in your cart or past orders is unaffected and can still be
            reviewed there.
          </p>
          <Button render={(props) => <Link to="/catalog" {...props} />}>Browse catalogue</Button>
        </CardContent>
      </Card>
    </div>
  );
}
