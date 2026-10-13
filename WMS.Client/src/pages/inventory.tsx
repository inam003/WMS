import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ToastAlert as Alert } from '../components/ToastProvider';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  getInventory,
  getLocations,
  getProducts,
  getWarehouses,
} from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function Inventory() {
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const productsQuery = useQuery({
    queryKey: queryKeys.products.list,
    queryFn: ({ signal }) => getProducts(signal),
  });
  const warehousesQuery = useQuery({
    queryKey: queryKeys.warehouses.all,
    queryFn: ({ signal }) => getWarehouses(signal),
  });
  const locationsQuery = useQuery({
    queryKey: queryKeys.locations.all,
    queryFn: ({ signal }) => getLocations(signal),
  });
  const products = productsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const locations = useMemo(
    () => locationsQuery.data ?? [],
    [locationsQuery.data],
  );
  const queryFilters = {
    ...(productId ? { productId } : {}),
    ...(warehouseId ? { warehouseId } : {}),
    ...(locationId ? { locationId } : {}),
  };
  const {
    data: inventory = [],
    isPending: isLoading,
    isError,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.inventory.list(queryFilters),
    queryFn: ({ signal }) => getInventory(queryFilters, signal),
  });
  const filterOptionError = [
    productsQuery.isError ? productsQuery.error : undefined,
    warehousesQuery.isError ? warehousesQuery.error : undefined,
    locationsQuery.isError ? locationsQuery.error : undefined,
  ].find((error) => error !== undefined);

  const visibleLocations = useMemo(
    () =>
      warehouseId
        ? locations.filter((location) => location.warehouseId === warehouseId)
        : locations,
    [locations, warehouseId],
  );

  const changeProduct = (value: string) => setProductId(value);

  const changeWarehouse = (value: string) => {
    setWarehouseId(value);
    setLocationId('');
  };

  const retryFilterOptions = () =>
    Promise.all([
      productsQuery.refetch(),
      warehousesQuery.refetch(),
      locationsQuery.refetch(),
    ]);

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, sm: 3 } }}>
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="overline"
                  color="primary"
                  sx={{ fontWeight: 700, letterSpacing: 1.2 }}
                >
                  WAREHOUSE OPERATIONS
                </Typography>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                  Inventory
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  View available stock by product and storage location.
                </Typography>
              </Box>

              {filterOptionError && (
                <Alert
                  severity="warning"
                  sx={{ mb: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => void retryFilterOptions()}
                    >
                      Retry
                    </Button>
                  }
                >
                  Filter options could not be loaded:{' '}
                  {errorMessage(filterOptionError)}
                </Alert>
              )}
              <Paper variant="outlined" sx={{ mb: 2, p: 2.5 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { md: 'center' } }}
                >
                  <FormControl
                    fullWidth
                    size="small"
                    sx={{ flex: '1 1 0', minWidth: { xs: '100%', md: 160 } }}
                  >
                    <InputLabel id="inventory-product-label">Product</InputLabel>
                    <Select
                      labelId="inventory-product-label"
                      label="Product"
                      value={productId}
                      onChange={(event) => changeProduct(event.target.value)}
                    >
                      <MenuItem value="">All products</MenuItem>
                      {products.map((product) => (
                        <MenuItem key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl
                    fullWidth
                    size="small"
                    sx={{ flex: '1 1 0', minWidth: { xs: '100%', md: 160 } }}
                  >
                    <InputLabel id="inventory-warehouse-label">Warehouse</InputLabel>
                    <Select
                      labelId="inventory-warehouse-label"
                      label="Warehouse"
                      value={warehouseId}
                      onChange={(event) => changeWarehouse(event.target.value)}
                    >
                      <MenuItem value="">All warehouses</MenuItem>
                      {warehouses.map((warehouse) => (
                        <MenuItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl
                    fullWidth
                    size="small"
                    sx={{ flex: '1 1 0', minWidth: { xs: '100%', md: 160 } }}
                  >
                    <InputLabel id="inventory-location-label">Location</InputLabel>
                    <Select
                      labelId="inventory-location-label"
                      label="Location"
                      value={locationId}
                      onChange={(event) => setLocationId(event.target.value)}
                    >
                      <MenuItem value="">All locations</MenuItem>
                      {visibleLocations.map((location) => (
                        <MenuItem key={location.id} value={location.id}>
                          {location.name} ({location.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    sx={{
                      flex: '0 0 140px',
                      minWidth: 140,
                      width: 140,
                      px: 2,
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      setProductId('');
                      setWarehouseId('');
                      setLocationId('');
                    }}
                  >
                    Clear filters
                  </Button>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack
                  direction="row"
                  sx={{ p: 2.5, justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      Stock on hand
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {inventory.length}{' '}
                      {inventory.length === 1 ? 'inventory record' : 'inventory records'}
                    </Typography>
                  </Box>
                </Stack>
                {isLoading ? (
                  <Stack
                    spacing={2}
                    sx={{ py: 8, alignItems: 'center' }}
                    role="status"
                  >
                    <CircularProgress size={30} />
                    <Typography color="text.secondary">
                      Loading inventory…
                    </Typography>
                  </Stack>
                ) : isError ? (
                  <Stack spacing={2} sx={{ alignItems: 'center', p: 4 }}>
                    <Alert severity="error" sx={{ width: '100%' }}>
                      {errorMessage(loadError)}
                    </Alert>
                    <Button
                      variant="outlined"
                      onClick={() => void refetch()}
                    >
                      Retry
                    </Button>
                  </Stack>
                ) : inventory.length === 0 ? (
                  <Stack spacing={1.5} sx={{ alignItems: 'center', py: 8, px: 2 }}>
                    <Inventory2OutlinedIcon color="action" sx={{ fontSize: 42 }} />
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      No inventory records found
                    </Typography>
                    <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                      Stock appears here when inventory records exist for the selected filters.
                    </Typography>
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell>Warehouse</TableCell>
                          <TableCell>Location</TableCell>
                          <TableCell align="right">Available quantity</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inventory.map((record) => (
                          <TableRow hover key={record.id}>
                            <TableCell>{record.productName}</TableCell>
                            <TableCell>{record.sku}</TableCell>
                            <TableCell>{record.warehouseName}</TableCell>
                            <TableCell>
                              {record.locationName} ({record.locationCode})
                            </TableCell>
                            <TableCell align="right">{record.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
      </Box>
    </Box>
  );
}
