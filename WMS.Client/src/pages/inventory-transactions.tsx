import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
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
  TextField,
  Typography,
} from '@mui/material';
import { ToastAlert as Alert } from '../components/ToastProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import {
  getInventoryTransactions,
  getLocations,
  getProducts,
  getWarehouses,
} from '../lib/api';
import type { InventoryTransactionFilters } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

interface TransactionFilterForm {
  productId: string;
  locationId: string;
  warehouseId: string;
  type: string;
  createdFrom: string;
  createdTo: string;
}

const emptyFilters: TransactionFilterForm = {
  productId: '',
  locationId: '',
  warehouseId: '',
  type: '',
  createdFrom: '',
  createdTo: '',
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

function toApiFilters(
  filters: TransactionFilterForm,
): InventoryTransactionFilters {
  return {
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    ...(filters.type.trim() ? { type: filters.type.trim() } : {}),
    ...(filters.createdFrom
      ? { createdFrom: new Date(filters.createdFrom).toISOString() }
      : {}),
    ...(filters.createdTo
      ? { createdTo: new Date(filters.createdTo).toISOString() }
      : {}),
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatTransactionType(type: string): string {
  if (type === 'AdjustmentIncrease') return 'Adjustment - Increase';
  if (type === 'AdjustmentDecrease') return 'Adjustment - Decrease';
  if (type === 'TransferOut') return 'Transfer - Out';
  if (type === 'TransferIn') return 'Transfer - In';
  return type;
}

function formatAdjustmentReason(reason: string | null): string {
  if (reason === 'DamagedStock') return 'Damaged stock';
  if (reason === 'LostOrMissingStock') return 'Lost or missing stock';
  if (reason === 'PhysicalCountCorrection') return 'Physical count correction';
  return reason ?? '—';
}

export function InventoryTransactions() {
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
  const [filters, setFilters] = useState<TransactionFilterForm>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<InventoryTransactionFilters>({});
  const [filterValidationError, setFilterValidationError] = useState<string>();
  const {
    data: transactions = [],
    isPending: isLoading,
    isError: isQueryError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.inventoryTransactions.list(appliedFilters),
    queryFn: ({ signal }) => getInventoryTransactions(appliedFilters, signal),
  });
  const filterOptionError = [
    productsQuery.isError ? productsQuery.error : undefined,
    warehousesQuery.isError ? warehousesQuery.error : undefined,
    locationsQuery.isError ? locationsQuery.error : undefined,
  ].find((error) => error !== undefined);
  const loadError =
    filterValidationError ??
    (isQueryError ? errorMessage(queryError) : undefined);
  const retryFilterOptions = () =>
    Promise.all([
      productsQuery.refetch(),
      warehousesQuery.refetch(),
      locationsQuery.refetch(),
    ]);

  const visibleLocations = useMemo(
    () =>
      filters.warehouseId
        ? locations.filter(
            (location) => location.warehouseId === filters.warehouseId,
          )
        : locations,
    [filters.warehouseId, locations],
  );

  const updateFilter = <K extends keyof TransactionFilterForm>(
    field: K,
    value: TransactionFilterForm[K],
  ) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = () => {
    if (
      filters.createdFrom &&
      filters.createdTo &&
      new Date(filters.createdFrom) > new Date(filters.createdTo)
    ) {
      setFilterValidationError(
        'The start date must be earlier than or equal to the end date.',
      );
      return;
    }
    setFilterValidationError(undefined);
    setAppliedFilters(toApiFilters(filters));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setFilterValidationError(undefined);
    setAppliedFilters({});
  };

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
                  Inventory transactions
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Review recorded inventory movements and references.
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
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                  >
                    <FormControl fullWidth size="small">
                      <InputLabel id="transaction-product-label">Product</InputLabel>
                      <Select
                        labelId="transaction-product-label"
                        label="Product"
                        value={filters.productId}
                        onChange={(event) =>
                          updateFilter('productId', event.target.value)
                        }
                      >
                        <MenuItem value="">All products</MenuItem>
                        {products.map((product) => (
                          <MenuItem key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                      <InputLabel id="transaction-warehouse-label">
                        Warehouse
                      </InputLabel>
                      <Select
                        labelId="transaction-warehouse-label"
                        label="Warehouse"
                        value={filters.warehouseId}
                        onChange={(event) => {
                          updateFilter('warehouseId', event.target.value);
                          updateFilter('locationId', '');
                        }}
                      >
                        <MenuItem value="">All warehouses</MenuItem>
                        {warehouses.map((warehouse) => (
                          <MenuItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} ({warehouse.code})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                      <InputLabel id="transaction-location-label">Location</InputLabel>
                      <Select
                        labelId="transaction-location-label"
                        label="Location"
                        value={filters.locationId}
                        onChange={(event) =>
                          updateFilter('locationId', event.target.value)
                        }
                      >
                        <MenuItem value="">All locations</MenuItem>
                        {visibleLocations.map((location) => (
                          <MenuItem key={location.id} value={location.id}>
                            {location.name} ({location.code})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth
                      size="small"
                      label="Transaction type"
                      value={filters.type}
                      onChange={(event) => updateFilter('type', event.target.value)}
                      helperText="Exact type match"
                    />
                  </Stack>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={2}
                      sx={{ alignItems: { md: 'center' } }}
                    >
                      <DateTimePicker
                        label="Created from"
                        value={
                          filters.createdFrom
                            ? dayjs(filters.createdFrom)
                            : null
                        }
                        onChange={(value) =>
                          updateFilter(
                            'createdFrom',
                            value?.isValid()
                              ? value.format('YYYY-MM-DDTHH:mm')
                              : '',
                          )
                        }
                        format="MMM D, YYYY HH:mm"
                        ampm={false}
                        slotProps={{
                          textField: { fullWidth: true, size: 'small' },
                        }}
                      />
                      <DateTimePicker
                        label="Created to"
                        value={
                          filters.createdTo ? dayjs(filters.createdTo) : null
                        }
                        onChange={(value) =>
                          updateFilter(
                            'createdTo',
                            value?.isValid()
                              ? value.format('YYYY-MM-DDTHH:mm')
                              : '',
                          )
                        }
                        format="MMM D, YYYY HH:mm"
                        ampm={false}
                        slotProps={{
                          textField: { fullWidth: true, size: 'small' },
                        }}
                      />
                      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                        <Button variant="contained" onClick={applyFilters}>
                          Apply filters
                        </Button>
                        <Button variant="outlined" onClick={clearFilters}>
                          Clear
                        </Button>
                      </Stack>
                    </Stack>
                  </LocalizationProvider>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack
                  direction="row"
                  sx={{ p: 2.5, justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      Transaction history
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {transactions.length}{' '}
                      {transactions.length === 1 ? 'transaction' : 'transactions'}
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
                      Loading transaction history…
                    </Typography>
                  </Stack>
                ) : loadError ? (
                  <Stack spacing={2} sx={{ alignItems: 'center', p: 4 }}>
                    <Alert severity="error" sx={{ width: '100%' }}>
                      {loadError}
                    </Alert>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setFilterValidationError(undefined);
                        void refetch();
                      }}
                    >
                      Retry
                    </Button>
                  </Stack>
                ) : transactions.length === 0 ? (
                  <Stack spacing={1.5} sx={{ alignItems: 'center', py: 8, px: 2 }}>
                    <HistoryOutlinedIcon color="action" sx={{ fontSize: 42 }} />
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      No transactions found
                    </Typography>
                    <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                      No inventory transactions match the selected filters.
                    </Typography>
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Created</TableCell>
                          <TableCell>Product</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Transfer ID</TableCell>
                          <TableCell>Adjustment reason</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell>Warehouse</TableCell>
                          <TableCell>Location</TableCell>
                          <TableCell>Reference</TableCell>
                          <TableCell>Created by</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {transactions.map((transaction) => (
                          <TableRow hover key={transaction.id}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {formatDate(transaction.createdAt)}
                            </TableCell>
                            <TableCell>{transaction.productName}</TableCell>
                            <TableCell>{transaction.sku}</TableCell>
                            <TableCell>{formatTransactionType(transaction.type)}</TableCell>
                            <TableCell>{transaction.transferId ?? '—'}</TableCell>
                            <TableCell>
                              {transaction.adjustmentReason
                                ? `${formatAdjustmentReason(transaction.adjustmentReason)}${
                                    transaction.adjustmentExplanation
                                      ? `: ${transaction.adjustmentExplanation}`
                                      : ''
                                  }`
                                : '—'}
                            </TableCell>
                            <TableCell align="right">{transaction.quantity}</TableCell>
                            <TableCell>{transaction.warehouseName}</TableCell>
                            <TableCell>
                              {transaction.locationName} ({transaction.locationCode})
                            </TableCell>
                            <TableCell>{transaction.referenceId ?? '—'}</TableCell>
                            <TableCell>{transaction.createdBy}</TableCell>
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
