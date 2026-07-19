import { Outlet } from 'react-router-dom';
import { CartProvider } from '@/hooks/CartContext';
import { AuthProvider } from '@/hooks/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider } from '@/components/ToastProvider';
import { ComparisonSelectionProvider } from '@/features/comparison/ComparisonSelectionContext';
import { Footer } from './Footer';
import { Header } from './Header';

export function Layout() {
  return (
    <AuthProvider>
      <CartProvider>
        <ComparisonSelectionProvider>
          <TooltipProvider>
            <ToastProvider>
              <div className="flex min-h-screen flex-col bg-background">
                <Header />
                <main className="content-shell w-full flex-1 py-6 sm:py-8">
                  <Outlet />
                </main>
                <Footer />
              </div>
            </ToastProvider>
          </TooltipProvider>
        </ComparisonSelectionProvider>
      </CartProvider>
    </AuthProvider>
  );
}
