import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './features/home/HomePage';
import { CatalogPage } from './features/catalog/CatalogPage';
import { ProductPage } from './features/product/ProductPage';
import { CartPage } from './features/cart/CartPage';
import { CheckoutPage } from './features/checkout/CheckoutPage';
import { OrderConfirmationPage } from './features/checkout/OrderConfirmationPage';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { AccountPage } from './features/account/AccountPage';
import { WishlistPage } from './features/wishlist/WishlistPage';
import { MailboxPage } from './features/mailbox/MailboxPage';
import { NotFoundPage } from './features/notFound/NotFoundPage';
import { BagDesignsPage } from './features/designs/BagDesignsPage';
import { HelpIndexPage } from './features/help/HelpIndexPage';
import { HelpArticlePage } from './features/help/HelpArticlePage';
import { ComparisonPage } from './features/comparison/ComparisonPage';
import { BundlesPage } from './features/bundles/BundlesPage';
import { CustomBlendPage } from './features/customBlend/CustomBlendPage';
import { OrderHistoryPage } from './features/orders/OrderHistoryPage';
import { OrderDetailPage } from './features/orders/OrderDetailPage';
import { AdminRoute } from './components/AdminRoute';
import { AdminReviewModerationPage } from './features/admin/reviews';
import { CompanyPage } from './features/company/CompanyPage';
import { AcceptInvitePage } from './features/company/AcceptInvitePage';
import { ApprovalsPage } from './features/approvals/ApprovalsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/compare" element={<ComparisonPage />} />
        <Route path="/bundles" element={<BundlesPage />} />
        <Route path="/custom-blend" element={<CustomBlendPage />} />
        <Route path="/products/:id" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/company"
          element={
            <ProtectedRoute>
              <CompanyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/approvals"
          element={
            <ProtectedRoute>
              <ApprovalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invites/accept"
          element={
            <ProtectedRoute>
              <AcceptInvitePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <ProtectedRoute>
              <WishlistPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrderHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <ProtectedRoute>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reviews"
          element={
            <AdminRoute>
              <AdminReviewModerationPage />
            </AdminRoute>
          }
        />
        <Route path="/mailbox" element={<MailboxPage />} />
        <Route path="/bag-designs" element={<BagDesignsPage />} />
        <Route path="/help" element={<HelpIndexPage />} />
        <Route path="/help/:slug" element={<HelpArticlePage group="help" />} />
        <Route path="/policies/:slug" element={<HelpArticlePage group="policy" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
