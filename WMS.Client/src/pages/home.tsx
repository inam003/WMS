import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ToastAlert as Alert } from '../components/ToastProvider';
import { BarChart, LineChart, PieChart } from '@mui/x-charts';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { Link } from 'react-router-dom';
import {
  getCategories,
  getInventory,
  getInventoryTransactions,
  getLocations,
  getOrders,
  getProducts,
  getWarehouses,
} from '../lib/api';
import type { CustomerOrderStatus } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

interface SummaryCardProps {
  title: string;
  value: number | undefined;
  loading: boolean;
  error?: string;
  to: string;
  icon: React.ReactNode;
  caption: string;
}

interface DashboardChartProps {
  title: string;
  subtitle: string;
  loading: boolean;
  error?: string;
  empty: boolean;
  children: React.ReactNode;
}

function DashboardChart({
  title,
  subtitle,
  loading,
  error,
  empty,
  children,
}: DashboardChartProps) {
  return (
    <Paper variant="outlined" sx={{ height: '100%', minWidth: 0, overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, pt: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      {loading ? (
        <Stack spacing={1.5} sx={{ minHeight: 300, alignItems: 'center', justifyContent: 'center' }} role="status">
          <CircularProgress size={26} />
          <Typography color="text.secondary">Loading chart…</Typography>
        </Stack>
      ) : error ? (
        <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
      ) : empty ? (
        <Stack sx={{ minHeight: 300, alignItems: 'center', justifyContent: 'center', px: 3 }}>
          <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
            Not enough data to display this chart yet.
          </Typography>
        </Stack>
      ) : (
        <Box sx={{ width: '100%', minWidth: 0, px: 1, pb: 1 }}>
          {children}
        </Box>
      )}
    </Paper>
  );
}

function SummaryCard({
  title,
  value,
  loading,
  error,
  to,
  icon,
  caption,
}: SummaryCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea
        component={Link}
        to={to}
        sx={{
          height: '100%',
          '&:hover .dashboard-card-icon': {
            bgcolor: 'primary.main',
            color: 'common.white',
          },
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 750 }}>
                {loading ? '—' : error ? '—' : (value ?? '—')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {error ? 'Unavailable' : caption}
              </Typography>
            </Box>
            <Box
              className="dashboard-card-icon"
              sx={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                color: 'primary.main',
                transition: 'background-color 150ms ease, color 150ms ease',
              }}
            >
              {icon}
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function getError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'The request failed.';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function Home() {
  const movementStart = new Date();
  movementStart.setMonth(movementStart.getMonth() - 11, 1);
  movementStart.setHours(0, 0, 0, 0);
  const productsQuery = useQuery({
    queryKey: queryKeys.products.list,
    queryFn: ({ signal }) => getProducts(signal),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: ({ signal }) => getCategories(signal),
  });
  const warehousesQuery = useQuery({
    queryKey: queryKeys.warehouses.all,
    queryFn: ({ signal }) => getWarehouses(signal),
  });
  const locationsQuery = useQuery({
    queryKey: queryKeys.locations.all,
    queryFn: ({ signal }) => getLocations(signal),
  });
  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory.list({}),
    queryFn: ({ signal }) => getInventory({}, signal),
  });
  const transactionsQuery = useQuery({
    queryKey: queryKeys.inventoryTransactions.list({}),
    queryFn: ({ signal }) =>
      getInventoryTransactions(
        { createdFrom: movementStart.toISOString() },
        signal,
      ),
  });
  const ordersQuery = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: ({ signal }) => getOrders(signal),
  });
  const queries = [
    productsQuery,
    categoriesQuery,
    warehousesQuery,
    locationsQuery,
    inventoryQuery,
    transactionsQuery,
    ordersQuery,
  ];
  const isRefreshing = queries.some((query) => query.isFetching);
  const errors = {
    ...(productsQuery.isError
      ? { products: getError(productsQuery.error) }
      : {}),
    ...(categoriesQuery.isError
      ? { categories: getError(categoriesQuery.error) }
      : {}),
    ...(warehousesQuery.isError
      ? { warehouses: getError(warehousesQuery.error) }
      : {}),
    ...(locationsQuery.isError
      ? { locations: getError(locationsQuery.error) }
      : {}),
    ...(inventoryQuery.isError
      ? { inventory: getError(inventoryQuery.error) }
      : {}),
    ...(transactionsQuery.isError
      ? { transactions: getError(transactionsQuery.error) }
      : {}),
    ...(ordersQuery.isError ? { orders: getError(ordersQuery.error) } : {}),
  };
  const refreshDashboard = () =>
    Promise.all(queries.map((query) => query.refetch()));

  const hasPartialFailures = Object.keys(errors).length > 0;
  const recentTransactions = [...(transactionsQuery.data ?? [])]
    .sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )
    .slice(0, 5);
  const totalStock = inventoryQuery.data?.reduce(
    (sum, record) => sum + record.quantity,
    0,
  );
  const stockByProduct = new Map<string, number>();
  inventoryQuery.data?.forEach((record) => {
    stockByProduct.set(
      record.productId,
      (stockByProduct.get(record.productId) ?? 0) + record.quantity,
    );
  });
  const lowStockCount =
    productsQuery.data?.filter(
      (product) =>
        (stockByProduct.get(product.id) ?? 0) <= product.minimumStockLevel,
    ).length ?? 0;
  const warehouseStock = new Map<string, { name: string; quantity: number }>();
  inventoryQuery.data?.forEach((record) => {
    const warehouse = warehouseStock.get(record.warehouseId) ?? {
      name: record.warehouseName,
      quantity: 0,
    };
    warehouse.quantity += record.quantity;
    warehouseStock.set(record.warehouseId, warehouse);
  });
  const warehouseChartData = [...warehouseStock.values()]
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 10);
  const topProducts = [...(productsQuery.data ?? [])]
    .map((product) => ({
      name:
        product.name.length > 22
          ? `${product.name.slice(0, 19)}…`
          : product.name,
      quantity: stockByProduct.get(product.id) ?? 0,
    }))
    .filter((product) => product.quantity > 0)
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 8);
  const orderStatuses = ['Draft', 'Ready', 'Dispatched', 'Cancelled'] as const;
  const getOrderStatus = (status: CustomerOrderStatus) =>
    typeof status === 'number' ? orderStatuses[status] : status;
  const ordersByStatus = orderStatuses.map((status) => ({
    id: status,
    label: status,
    value:
      ordersQuery.data?.filter(
        (order) => getOrderStatus(order.status) === status,
      ).length ?? 0,
  }));
  const monthKeys: string[] = [];
  const monthLabels: string[] = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    monthKeys.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    );
    monthLabels.push(
      date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
    );
  }
  const receivedByMonth = new Map(monthKeys.map((key) => [key, 0]));
  const dispatchedByMonth = new Map(monthKeys.map((key) => [key, 0]));
  transactionsQuery.data?.forEach((transaction) => {
    const date = new Date(transaction.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (transaction.type === 'Receipt') {
      receivedByMonth.set(
        key,
        (receivedByMonth.get(key) ?? 0) + transaction.quantity,
      );
    } else if (transaction.type === 'Dispatch') {
      dispatchedByMonth.set(
        key,
        (dispatchedByMonth.get(key) ?? 0) + transaction.quantity,
      );
    }
  });
  const receivedValues = monthKeys.map((key) => receivedByMonth.get(key) ?? 0);
  const dispatchedValues = monthKeys.map((key) => dispatchedByMonth.get(key) ?? 0);
  const movementAvailable =
    receivedValues.some((value) => value > 0) ||
    dispatchedValues.some((value) => value > 0);
  const inventoryLoading = inventoryQuery.isPending;
  const productStockLoading = inventoryQuery.isPending || productsQuery.isPending;
  const movementLoading = transactionsQuery.isPending;
  const warehouseChartError = errors.inventory;
  const productChartError = errors.inventory ?? errors.products;
  const movementChartError = errors.transactions;
  const ordersChartError = errors.orders;

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, sm: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 700, letterSpacing: 1.3 }}
          >
            WAREHOUSE MANAGEMENT
          </Typography>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 750, fontSize: { xs: '1.8rem', sm: '2.25rem' } }}
          >
            Dashboard
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            A live overview of your catalog, storage, and recorded movements.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => void refreshDashboard()}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh data'}
        </Button>
      </Stack>

      {hasPartialFailures && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => void refreshDashboard()}
            >
              Retry
            </Button>
          }
        >
          Some dashboard data could not be loaded.{' '}
          {Object.entries(errors)
            .map(([metric, message]) => `${metric}: ${message}`)
            .join(' ')}
          {' '}Affected metrics show as unavailable.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <SummaryCard
            title="Products"
            value={productsQuery.data?.length}
            loading={productsQuery.isPending}
            error={errors.products}
            to="/products"
            icon={<Inventory2OutlinedIcon />}
            caption="Manage product catalog"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <SummaryCard
            title="Categories"
            value={categoriesQuery.data?.length}
            loading={categoriesQuery.isPending}
            error={errors.categories}
            to="/categories"
            icon={<CategoryOutlinedIcon />}
            caption="Organize product catalog"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <SummaryCard
            title="Warehouses"
            value={warehousesQuery.data?.length}
            loading={warehousesQuery.isPending}
            error={errors.warehouses}
            to="/warehouses"
            icon={<WarehouseOutlinedIcon />}
            caption="Manage warehouse sites"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <SummaryCard
            title="Locations"
            value={locationsQuery.data?.length}
            loading={locationsQuery.isPending}
            error={errors.locations}
            to="/locations"
            icon={<PlaceOutlinedIcon />}
            caption="Manage storage locations"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <SummaryCard
            title="Units in stock"
            value={totalStock}
            loading={inventoryQuery.isPending}
            error={errors.inventory}
            to="/inventory"
            icon={<StorageOutlinedIcon />}
            caption="Total quantity across all locations"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <SummaryCard
            title="Low-stock products"
            value={lowStockCount}
            loading={inventoryQuery.isPending || productsQuery.isPending}
            error={errors.inventory ?? errors.products}
            to="/inventory"
            icon={<StorageOutlinedIcon />}
            caption="At or below minimum stock level"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <SummaryCard
            title="Open orders"
            value={
              ordersQuery.data?.filter(
                (order) =>
                  getOrderStatus(order.status) === 'Draft' ||
                  getOrderStatus(order.status) === 'Ready',
              ).length
            }
            loading={ordersQuery.isPending}
            error={errors.orders}
            to="/orders"
            icon={<HistoryOutlinedIcon />}
            caption="Draft and ready to dispatch"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardChart
            title="Stock by warehouse"
            subtitle="Units currently available at each site"
            loading={inventoryLoading}
            error={warehouseChartError}
            empty={warehouseChartData.length === 0}
          >
            <BarChart
              height={320}
              dataset={warehouseChartData}
              xAxis={[{ scaleType: 'band', dataKey: 'name' }]}
              series={[{ dataKey: 'quantity', label: 'Units in stock', color: '#2563eb' }]}
              margin={{ left: 64, right: 20, top: 24, bottom: 48 }}
              grid={{ horizontal: true }}
              hideLegend
            />
          </DashboardChart>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardChart
            title="Stock movement trends"
            subtitle="Monthly quantities received and dispatched"
            loading={movementLoading}
            error={movementChartError}
            empty={!movementAvailable}
          >
            <LineChart
              height={320}
              xAxis={[{ scaleType: 'band', data: monthLabels }]}
              series={[
                { data: receivedValues, label: 'Received', color: '#16a34a', curve: 'monotoneX' },
                { data: dispatchedValues, label: 'Dispatched', color: '#f97316', curve: 'monotoneX' },
              ]}
              margin={{ left: 64, right: 24, top: 24, bottom: 48 }}
              grid={{ horizontal: true }}
            />
          </DashboardChart>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardChart
            title="Orders by status"
            subtitle="Current order workflow"
            loading={ordersQuery.isPending}
            error={ordersChartError}
            empty={!ordersQuery.data?.length}
          >
            <PieChart
              height={320}
              series={[
                {
                  data: ordersByStatus,
                  innerRadius: 58,
                  outerRadius: 112,
                  paddingAngle: 2,
                  cornerRadius: 4,
                  arcLabel: 'value',
                },
              ]}
              slotProps={{ legend: { position: { vertical: 'middle', horizontal: 'end' } } }}
              margin={{ left: 12, right: 24, top: 20, bottom: 20 }}
            />
          </DashboardChart>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardChart
            title="Receiving vs. dispatch"
            subtitle="Monthly units moved in and out"
            loading={movementLoading}
            error={movementChartError}
            empty={!movementAvailable}
          >
            <BarChart
              height={320}
              xAxis={[{ scaleType: 'band', data: monthLabels }]}
              series={[
                { data: receivedValues, label: 'Received', stack: 'quantity', color: '#16a34a' },
                { data: dispatchedValues, label: 'Dispatched', stack: 'quantity', color: '#f97316' },
              ]}
              margin={{ left: 64, right: 24, top: 24, bottom: 48 }}
              grid={{ horizontal: true }}
            />
          </DashboardChart>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <DashboardChart
            title="Top products by stock"
            subtitle="Products with the most units across all locations"
            loading={productStockLoading}
            error={productChartError}
            empty={topProducts.length === 0}
          >
            <BarChart
              height={340}
              layout="horizontal"
              dataset={topProducts}
              yAxis={[{ scaleType: 'band', dataKey: 'name' }]}
              series={[{ dataKey: 'quantity', label: 'Units in stock', color: '#6366f1' }]}
              margin={{ left: 140, right: 36, top: 24, bottom: 48 }}
              grid={{ vertical: true }}
              hideLegend
            />
          </DashboardChart>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Paper variant="outlined" sx={{ height: '100%', overflow: 'hidden' }}>
            <Stack
              direction="row"
              sx={{ p: 2.5, alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Recent transactions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Latest recorded inventory activity
                </Typography>
              </Box>
              <Button
                component={Link}
                to="/inventory-transactions"
                endIcon={<ArrowForwardRoundedIcon />}
              >
                View all
              </Button>
            </Stack>
            {transactionsQuery.isPending ? (
              <Stack spacing={2} sx={{ py: 5, alignItems: 'center' }} role="status">
                <CircularProgress size={26} />
                <Typography color="text.secondary">Loading transactions…</Typography>
              </Stack>
            ) : transactionsQuery.isError ? (
              <Alert severity="error" sx={{ mx: 2.5, mb: 2.5 }}>
                {getError(transactionsQuery.error)}
              </Alert>
            ) : recentTransactions.length === 0 ? (
              <Stack spacing={1} sx={{ alignItems: 'center', py: 5, px: 2 }}>
                <HistoryOutlinedIcon color="action" />
                <Typography color="text.secondary">
                  No inventory transactions have been recorded.
                </Typography>
              </Stack>
            ) : (
              <List disablePadding>
                {recentTransactions.map((transaction, index) => (
                  <ListItemButton
                    key={transaction.id}
                    component={Link}
                    to="/inventory-transactions"
                    divider={index < recentTransactions.length - 1}
                    sx={{ px: 2.5, py: 1.5, alignItems: 'flex-start' }}
                  >
                    <ListItemText
                      primary={
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          sx={{ justifyContent: 'space-between', gap: 0.5 }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {transaction.type} · {transaction.productName} ({transaction.sku})
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {transaction.quantity}
                          </Typography>
                        </Stack>
                      }
                      secondary={`${transaction.warehouseName} · ${transaction.locationName} · ${formatDate(transaction.createdAt)}`}
                      slotProps={{
                        secondary: {
                          sx: { mt: 0.5, overflowWrap: 'anywhere' },
                        },
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
      </Box>
    </Box>
  );
}
