import { Route, Routes } from 'react-router-dom';
import { Account } from './pages/account';
import { Auth } from './pages/auth';
import { AuthenticatedLayout } from './components/AuthenticatedLayout';
import { Categories } from './pages/categories';
import { Home } from './pages/home';
import { Inventory } from './pages/inventory';
import { InventoryAdjustments } from './pages/inventory-adjustments';
import { InventoryTransactions } from './pages/inventory-transactions';
import { Orders } from './pages/orders';
import { Locations } from './pages/locations';
import { Products } from './pages/products';
import { Reports } from './pages/reports';
import { Receiving } from './pages/receiving';
import { Warehouses } from './pages/warehouses';
import { WarehouseTransfers } from './pages/warehouse-transfers';

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
        <Route path="/inventory-adjustments" element={<InventoryAdjustments />} />
        <Route path="/receiving" element={<Receiving />} />
        <Route path="/warehouse-transfers" element={<WarehouseTransfers />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/inventory-transactions"
          element={<InventoryTransactions />}
        />
      </Route>
      <Route path="/auth/:pathname" element={<Auth />} />
    </Routes>
  );
}