import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CatalogPage } from './features/catalog/CatalogPage';
import { CartPage } from './features/cart/CartPage';
import { CheckoutPage } from './features/checkout/CheckoutPage';
import { OrderConfirmationPage } from './features/checkout/OrderConfirmationPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
      </Route>
    </Routes>
  );
}
