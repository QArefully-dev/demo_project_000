import { Outlet } from 'react-router-dom';
import { useCountry } from '@/hooks/CountryContext';
import { AdminNav } from './AdminNav';

/** Shared container for protected administration routes. */
export function AdminLayout() {
  const { activeCountry } = useCountry();

  return (
    <section className="mx-auto max-w-6xl space-y-6" aria-labelledby="admin-shell-heading">
      <header>
        <p className="section-eyebrow">Administration</p>
        <h1 id="admin-shell-heading" className="section-heading mt-2">
          Operations console
        </h1>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="admin-standing-country">
          Standing country: <span className="font-medium text-foreground">{activeCountry}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Jobs, webhooks, and feature flags are global sections.
        </p>
      </header>
      <AdminNav />
      {/*
       * Route pages own their fetch effects. Remounting the outlet when the standing country
       * changes makes every section issue a fresh server-authorized request without introducing
       * client-side filtering or section-specific country state.
       */}
      <div key={activeCountry} data-testid="admin-country-outlet">
        <Outlet />
      </div>
    </section>
  );
}
