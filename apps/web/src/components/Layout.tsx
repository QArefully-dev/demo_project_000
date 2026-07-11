import { Outlet } from 'react-router-dom';
import { CartProvider } from '@/hooks/CartContext';
import { AuthProvider } from '@/hooks/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Header } from './Header';

export function Layout() {
  return (
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto px-4 py-6">
              <Outlet />
            </main>
          </div>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  );
}
