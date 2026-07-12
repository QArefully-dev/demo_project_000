import { Link } from 'react-router-dom';
import { CategoryNav } from './CategoryNav';
import { SearchBar } from './SearchBar';
import { AccountMenu } from './AccountMenu';
import { WishlistButton } from './WishlistButton';
import { CartSheet } from './CartSheet';

/** Composes the sticky storefront navigation and customer controls. */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="content-shell">
        <div className="grid min-h-[4.5rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 sm:gap-x-4 lg:h-[4.5rem] lg:grid-cols-[auto_minmax(20rem,1fr)_auto] lg:gap-x-7 lg:py-0">
          <Link
            to="/"
            className="w-fit rounded-md text-lg font-bold tracking-[-0.045em] text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-xl"
          >
            Shop <span className="text-foreground">Qarefully</span>
          </Link>
          <div
            role="group"
            aria-label="Customer tools"
            className="flex items-center justify-end gap-0.5 whitespace-nowrap sm:gap-1 lg:order-2 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring [&_a:focus-visible]:ring-offset-2 [&_button:focus-visible]:ring-ring [&_button:focus-visible]:ring-offset-2"
          >
            <AccountMenu />
            <WishlistButton />
            <CartSheet />
          </div>
          <SearchBar className="order-3 col-span-full lg:order-1 lg:col-span-1" />
        </div>
      </div>
      <div className="border-t border-border bg-surface-raised/80">
        <div className="content-shell flex h-11 items-center justify-between gap-4 overflow-x-auto [scrollbar-width:none]">
          <CategoryNav />
          <p className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground xl:block">
            Curated essentials · Demo checkout · No real payment
          </p>
        </div>
      </div>
    </header>
  );
}
