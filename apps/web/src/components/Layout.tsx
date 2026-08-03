import { Outlet } from 'react-router-dom';
import { CartProvider } from '@/hooks/CartContext';
import { SavedListsProvider } from '@/hooks/SavedListsContext';
import { AuthProvider } from '@/hooks/AuthContext';
import { NotificationsProvider } from '@/hooks/NotificationsContext';
import { BackInStockProvider } from '@/hooks/BackInStockContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider } from '@/components/ToastProvider';
import { ComparisonSelectionProvider } from '@/features/comparison/ComparisonSelectionContext';
import { Footer } from './Footer';
import { Header } from './Header';

export function Layout() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <BackInStockProvider>
          <CartProvider>
            <SavedListsProvider>
              <ComparisonSelectionProvider>
                <TooltipProvider>
                  <ToastProvider>
                    <div className="flex min-h-screen flex-col bg-background">
                      <Header />
                      <main className="content-shell flex-1 py-6 sm:py-8">
                        <Outlet />
                      </main>
                      <Footer />
                    </div>
                  </ToastProvider>
                </TooltipProvider>
              </ComparisonSelectionProvider>
            </SavedListsProvider>
          </CartProvider>
        </BackInStockProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
