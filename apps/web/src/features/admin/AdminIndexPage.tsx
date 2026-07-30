import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

const sections = [
  ['Product catalogue', 'Manage products and their purchasable variants.', '/admin/products'],
  ['Variants', 'Set stock, delivery details, and clearance pricing.', '/admin/variants'],
  ['Promotions', 'Create and maintain trade promotion codes.', '/admin/promos'],
  ['Users', 'Manage customer access, profile details, and roles.', '/admin/users'],
  ['Orders', 'Review orders and issue simulated refunds.', '/admin/orders'],
  ['Feature flags', 'Control local rollout flags for the application.', '/admin/feature-flags'],
  ['Review moderation', 'Review reported and hidden customer reviews.', '/admin/reviews'],
] as const;

/** Landing page for administrator-only operational areas. */
export function AdminIndexPage() {
  return (
    <div aria-labelledby="admin-index-heading">
      <h2 id="admin-index-heading" className="text-2xl font-semibold tracking-tight">
        Administration overview
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Select an operational area to continue.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {sections.map(([title, description, to]) => (
          <li key={to}>
            <Card className="h-full">
              <CardContent className="space-y-2 py-5">
                <Link to={to} className="font-semibold underline-offset-4 hover:underline">
                  {title}
                </Link>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
