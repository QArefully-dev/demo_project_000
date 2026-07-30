import { NavLink } from 'react-router-dom';

const sections = [
  ['Overview', '/admin'],
  ['Products', '/admin/products'],
  ['Variants', '/admin/variants'],
  ['Promotions', '/admin/promos'],
  ['Users', '/admin/users'],
  ['Orders', '/admin/orders'],
  ['Feature flags', '/admin/feature-flags'],
  ['Review moderation', '/admin/reviews'],
] as const;

/** Stable administration navigation shared by all admin routes. */
export function AdminNav() {
  return (
    <nav aria-label="Administration" className="rounded-lg border border-border bg-card p-3">
      <ul className="flex flex-wrap gap-1">
        {sections.map(([label, to]) => (
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
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
