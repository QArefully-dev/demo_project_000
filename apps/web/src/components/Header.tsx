import { Link } from 'react-router-dom';
import { CategoryNav } from './CategoryNav';
import { SearchBar } from './SearchBar';
import { AccountMenu } from './AccountMenu';
import { WishlistButton } from './WishlistButton';
import { CartSheet } from './CartSheet';

/** Composes the full top navigation bar: logo, category nav, search, wishlist, account, and cart. */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex items-center gap-6 h-14 px-4">
        <Link to="/" className="text-lg font-bold tracking-tight flex-shrink-0">
          Shop Qarefully
        </Link>
        <CategoryNav />
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <SearchBar />
          <WishlistButton />
          <AccountMenu />
          <CartSheet />
        </div>
      </div>
    </header>
  );
}
