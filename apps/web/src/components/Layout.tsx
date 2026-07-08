import { Link, Outlet } from 'react-router-dom';
import { CartProvider } from '@/hooks/CartContext';
import { CartSheet } from './CartSheet';

export function Layout() {
  return (
    <CartProvider>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex items-center justify-between h-14 px-4">
            <Link to="/" className="text-lg font-bold tracking-tight">
              Shop Qarefully
            </Link>
            <CartSheet />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <Outlet />
        </main>
      </div>
    </CartProvider>
  );
}
