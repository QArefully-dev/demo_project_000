import { Outlet } from 'react-router-dom';
import { CartProvider } from '@/hooks/CartContext';
import { AuthProvider } from '@/hooks/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider } from '@/components/ToastProvider';
import { Header } from './Header';

export function Layout() {
  return (
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <ToastProvider>
            <div className="min-h-screen bg-background">
              <Header />
              <main className="container mx-auto px-4 py-6">
                <Outlet />
              </main>
            </div>
          </ToastProvider>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  );
}
