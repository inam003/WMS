import { useQuery } from '@tanstack/react-query';
import {
  Alert,
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
  getProducts,
  getWarehouses,
} from '../lib/api';
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
    queryFn: ({ signal }) => getInventoryTransactions({}, signal),
  });
  const queries = [
    productsQuery,
    categoriesQuery,
    warehousesQuery,
    locationsQuery,
    inventoryQuery,
    transactionsQuery,
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
  };
  const refreshDashboard = () =>
    Promise.all(queries.map((query) => query.refetch()));

  const hasPartialFailures = Object.keys(errors).length > 0;
  const recentTransactions = transactionsQuery.data?.slice(0, 5) ?? [];

  return (
    <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, maxWidth: 1500, mx: 'auto' }}>
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
            title="Inventory records"
            value={inventoryQuery.data?.length}
            loading={inventoryQuery.isPending}
            error={errors.inventory}
            to="/inventory"
            icon={<StorageOutlinedIcon />}
            caption="Product-location stock records"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
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
  );
}
