import { Alert, Box, Button } from '@mui/material';
import { Link as RouterLink, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
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
import { Users } from './pages/users';
import { AuditHistory } from './pages/audit-history';
import { useWmsAccess } from './hooks/useWmsAccess';
import type { WmsRole } from './lib/api';

function RequireRoles({
  allowedRoles,
  children,
}: {
  allowedRoles: WmsRole[];
  children: ReactNode;
}) {
  const user = useWmsAccess();
  if (allowedRoles.includes(user.role)) return children;
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
      <Alert
        severity="error"
        action={
          <Button component={RouterLink} to="/" color="inherit" size="small">
            Dashboard
          </Button>
        }
      >
        Your WMS role does not permit access to this page.
      </Alert>
    </Box>
  );
}

const operationalRoles: WmsRole[] = [
  'Admin',
  'WarehouseManager',
  'WarehouseOperator',
];
const adminRoles: WmsRole[] = ['Admin'];

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
        <Route path="/inventory-adjustments" element={<RequireRoles allowedRoles={operationalRoles}><InventoryAdjustments /></RequireRoles>} />
        <Route path="/receiving" element={<RequireRoles allowedRoles={operationalRoles}><Receiving /></RequireRoles>} />
        <Route path="/warehouse-transfers" element={<RequireRoles allowedRoles={operationalRoles}><WarehouseTransfers /></RequireRoles>} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<RequireRoles allowedRoles={adminRoles}><Users /></RequireRoles>} />
        <Route path="/audit-history" element={<RequireRoles allowedRoles={adminRoles}><AuditHistory /></RequireRoles>} />
        <Route
          path="/inventory-transactions"
          element={<InventoryTransactions />}
        />
      </Route>
      <Route path="/auth/:pathname" element={<Auth />} />
    </Routes>
  );
}