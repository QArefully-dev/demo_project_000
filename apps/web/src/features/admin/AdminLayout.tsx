import { Outlet } from 'react-router-dom';
import { AdminNav } from './AdminNav';

/** Shared container for protected administration routes. */
export function AdminLayout() {
  return (
    <section className="mx-auto max-w-6xl space-y-6" aria-labelledby="admin-shell-heading">
      <header>
        <p className="section-eyebrow">Administration</p>
        <h1 id="admin-shell-heading" className="section-heading mt-2">
          Operations console
        </h1>
      </header>
      <AdminNav />
      <Outlet />
    </section>
  );
}
