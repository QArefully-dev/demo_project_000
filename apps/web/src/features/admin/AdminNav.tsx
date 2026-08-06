import { NavLink } from 'react-router-dom';

const sections = [
  { label: 'Overview', to: '/admin', global: false },
  { label: 'Products', to: '/admin/products', global: false },
  { label: 'Variants', to: '/admin/variants', global: false },
  { label: 'Promotions', to: '/admin/promos', global: false },
  { label: 'Users', to: '/admin/users', global: false },
  { label: 'Orders', to: '/admin/orders', global: false },
  { label: 'Jobs', to: '/admin/jobs', global: true },
  { label: 'Webhooks', to: '/admin/webhooks', global: true },
  { label: 'Feature flags', to: '/admin/feature-flags', global: true },
  { label: 'Review moderation', to: '/admin/reviews', global: false },
] as const;

/** Stable administration navigation shared by all admin routes. */
export function AdminNav() {
  return (
    <nav aria-label="Administration" className="rounded-lg border border-border bg-card p-3">
      <ul className="flex flex-wrap gap-1">
        {sections.map(({ label, to, global }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`
              }
            >
              {label}
              {global && (
                <span className="ml-1 text-[0.65rem] font-semibold uppercase tracking-wide opacity-70">
                  global
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
