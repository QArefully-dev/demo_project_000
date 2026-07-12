import { Link } from 'react-router-dom';
import { CategoryNav } from './CategoryNav';
import { SearchBar } from './SearchBar';
import { AccountMenu } from './AccountMenu';
import { WishlistButton } from './WishlistButton';
import { CartSheet } from './CartSheet';

/** Composes the full top navigation bar: logo, category nav, search, wishlist, account, and cart. */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="content-shell flex min-h-16 flex-wrap items-center gap-3 py-3 lg:flex-nowrap lg:gap-6">
        <Link
          to="/"
          className="flex-shrink-0 rounded-md text-xl font-bold tracking-[-0.04em] text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Shop Qarefully
        </Link>
        <SearchBar className="order-3 basis-full lg:order-none lg:max-w-2xl lg:flex-1" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <WishlistButton />
          <AccountMenu />
          <CartSheet />
        </div>
      </div>
      <div className="border-t bg-surface-raised/80">
        <div className="content-shell flex h-10 items-center justify-between gap-4 overflow-x-auto">
          <CategoryNav />
          <p className="hidden whitespace-nowrap text-xs font-medium text-muted-foreground md:block">
            Thoughtfully selected · Demo checkout · No real payment
          </p>
        </div>
      </div>
    </header>
  );
}
