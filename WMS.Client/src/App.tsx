import { Route, Routes } from 'react-router-dom';
import { Account } from './pages/account';
import { Auth } from './pages/auth';
import { AuthenticatedLayout } from './components/AuthenticatedLayout';
import { Categories } from './pages/categories';
import { Home } from './pages/home';
import { Inventory } from './pages/inventory';
import { InventoryTransactions } from './pages/inventory-transactions';
import { Locations } from './pages/locations';
import { Products } from './pages/products';
import { Warehouses } from './pages/warehouses';

export default function App() {
  return (
    <Routes>
      <Route element={<AuthenticatedLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/:pathname" element={<Account />} />
        <Route path="/products" element={<Products />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/warehouses" element={<Warehouses />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route
          path="/inventory-transactions"
          element={<InventoryTransactions />}
        />
      </Route>
      <Route path="/auth/:pathname" element={<Auth />} />
    </Routes>
  );
}