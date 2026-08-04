import { Link } from 'react-router-dom';
import { List } from 'lucide-react';
import { CategoryNav } from './CategoryNav';
import { SearchBar } from './SearchBar';
import { AccountMenu } from './AccountMenu';
import { CountryPicker } from './CountryPicker';
import { useSavedLists } from '@/hooks/useSavedLists';
import { CartSheet } from './CartSheet';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { useAuth } from '@/hooks/AuthContext';
import { useCountry } from '@/hooks/CountryContext';

/** Composes the sticky storefront navigation and customer controls. */
export function Header() {
  const { user } = useAuth();
  const { activeCountry, selectCountry } = useCountry();
  const { defaultList } = useSavedLists();
  const defaultItemCount = defaultList?.items.length ?? 0;

  const countryDisabled = user !== null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background shadow-sm">
      <div className="content-shell">
        <div className="grid min-h-[4.5rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 sm:gap-x-4 lg:h-[4.5rem] lg:grid-cols-[auto_minmax(20rem,1fr)_auto] lg:gap-x-7 lg:py-0">
          <Link
            to="/"
            aria-label="QArefully Materials Exchange"
            className="w-fit rounded-md font-semibold tracking-[-0.055em] text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-xl"
          >
            <span className="font-black text-primary">QA</span>refully Materials Exchange
          </Link>
          <div
            role="group"
            aria-label="Customer tools"
            className="flex items-center justify-end gap-0.5 whitespace-nowrap sm:gap-1 lg:order-2 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring [&_a:focus-visible]:ring-offset-2 [&_button:focus-visible]:ring-ring [&_button:focus-visible]:ring-offset-2"
          >
            <CountryPicker
              value={activeCountry}
              onChange={selectCountry}
              disabled={countryDisabled}
            />
            <AccountMenu />
            {user && <NotificationBell />}
            <Link
              to="/lists"
              aria-label={`Saved lists${defaultItemCount > 0 ? ` (${defaultItemCount})` : ''}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <List className="size-4" aria-hidden="true" />
              Lists
              {defaultItemCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  {defaultItemCount}
                </span>
              )}
            </Link>
            <CartSheet />
          </div>
          <SearchBar className="order-3 col-span-full lg:order-1 lg:col-span-1" />
        </div>
      </div>
      <div className="border-t border-border bg-surface-raised/80">
        <div className="content-shell flex h-11 items-center justify-between gap-4 overflow-x-auto [scrollbar-width:none]">
          <CategoryNav />
          <p className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground xl:block">
            Materials data · Available stock · Trade supply
          </p>
        </div>
      </div>
    </header>
  );
}
