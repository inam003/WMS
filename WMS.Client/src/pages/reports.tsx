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
  TablePagination,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { ToastAlert as Alert } from '../components/ToastProvider';
import { DateFilterField } from '../components/DateFilterField';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import {
  getLocations,
  getProducts,
  getReportPage,
  getWarehouses,
} from '../lib/api';
import type {
  Location,
  OrderReportRow,
  ReportFilters,
  ReportKind,
  StockReportRow,
  TransferReportRow,
} from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

const reportTabs: { kind: ReportKind; label: string }[] = [
  { kind: 'stock', label: 'Current stock' },
  { kind: 'movements', label: 'Inventory movements' },
  { kind: 'receiving', label: 'Receiving' },
  { kind: 'adjustments', label: 'Adjustments' },
  { kind: 'transfers', label: 'Transfers' },
  { kind: 'orders', label: 'Orders & dispatch' },
];

const pageSize = 25;

interface FilterForm {
  productId: string;
  warehouseId: string;
  locationId: string;
  keyword: string;
  transactionType: string;
  startDate: string;
  endDate: string;
}

const emptyFilters: FilterForm = {
  productId: '',
  warehouseId: '',
  locationId: '',
  keyword: '',
  transactionType: '',
  startDate: '',
  endDate: '',
};

type DisplayRow = Record<string, string | number>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatQuantity(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatOrderStatus(value: string | number): string {
  if (typeof value === 'number') {
    return ['Draft', 'Ready', 'Dispatched', 'Cancelled'][value] ?? String(value);
  }
  return value;
}

function formatAdjustmentReason(value: string | number | null): string {
  if (typeof value === 'number') {
    return [
      'Unspecified',
      'Damaged stock',
      'Lost or missing stock',
      'Physical count correction',
      'Other',
    ][value] ?? String(value);
  }
  return value
    ? value.replace(/([a-z])([A-Z])/g, '$1 $2')
    : '';
}

function toApiFilters(filters: FilterForm, page: number): ReportFilters {
  return {
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.keyword.trim() ? { keyword: filters.keyword.trim() } : {}),
    ...(filters.transactionType
      ? { transactionType: filters.transactionType }
      : {}),
    ...(filters.startDate
      ? { startDate: new Date(`${filters.startDate}T00:00:00`).toISOString() }
      : {}),
    ...(filters.endDate
      ? { endDate: new Date(`${filters.endDate}T23:59:59.999`).toISOString() }
      : {}),
    page,
    pageSize,
  };
}

function filtersForKind(
  kind: ReportKind,
  filters: ReportFilters,
): ReportFilters {
  const result = { ...filters };
  if (kind === 'stock') {
    delete result.startDate;
    delete result.endDate;
    delete result.transactionType;
  } else if (kind !== 'movements') {
    delete result.transactionType;
  }
  return result;
}

function displayRows(kind: ReportKind, data: unknown[]): {
  headers: string[];
  rows: DisplayRow[];
} {
  if (kind === 'stock') {
    const rows = data as StockReportRow[];
    return {
      headers: [
        'Product',
        'SKU',
        'Barcode',
        'Warehouse',
        'Location',
        'Available quantity',
      ],
      rows: rows.map((row) => ({
        Product: row.productName,
        SKU: row.sku,
        Barcode: row.barcode ?? '',
        Warehouse: row.warehouseName,
        Location: `${row.locationName} (${row.locationCode})`,
        'Available quantity': row.quantity,
      })),
    };
  }

  if (kind === 'transfers') {
    const rows = data as TransferReportRow[];
    return {
      headers: [
        'Transfer ID',
        'Product',
        'SKU',
        'Quantity',
        'Source warehouse',
        'Source location',
        'Destination warehouse',
        'Destination location',
        'Reference',
        'Creator',
        'Date',
      ],
      rows: rows.map((row) => ({
        'Transfer ID': row.transferId,
        Product: row.productName,
        SKU: row.sku,
        Quantity: row.quantity,
        'Source warehouse': row.sourceWarehouseName,
        'Source location': `${row.sourceLocationName} (${row.sourceLocationCode})`,
        'Destination warehouse': row.destinationWarehouseName,
        'Destination location': `${row.destinationLocationName} (${row.destinationLocationCode})`,
        Reference: row.referenceId ?? '',
        Creator: row.createdBy,
        Date: formatDate(row.createdAt),
      })),
    };
  }

  if (kind === 'orders') {
    const rows = data as OrderReportRow[];
    return {
      headers: [
        'Order number',
        'Status',
        'Customer',
        'Reference',
        'Product',
        'SKU',
        'Requested',
        'Dispatched',
        'Dispatch warehouse',
        'Dispatch location',
        'Creator',
        'Created',
        'Dispatched by',
        'Dispatched at',
      ],
      rows: rows.map((row) => ({
        'Order number': row.orderNumber,
        Status: formatOrderStatus(row.status),
        Customer: row.customerName ?? '',
        Reference: row.referenceId ?? '',
        Product: row.productName,
        SKU: row.sku,
        Requested: row.requestedQuantity,
        Dispatched: row.dispatchedQuantity,
        'Dispatch warehouse': row.dispatchWarehouseName ?? '',
        'Dispatch location': row.dispatchLocationName
          ? `${row.dispatchLocationName} (${row.dispatchLocationCode ?? ''})`
          : '',
        Creator: row.createdBy,
        Created: formatDate(row.createdAt),
        'Dispatched by': row.dispatchedBy ?? '',
        'Dispatched at': formatDate(row.dispatchedAt),
      })),
    };
  }

  const rows = data as {
    transactionId: string;
    productName: string;
    sku: string;
    type: string;
    quantity: number;
    warehouseName: string;
    locationName: string;
    locationCode: string;
    referenceId: string | null;
    createdBy: string;
    createdAt: string;
    adjustmentReason: string | number | null;
    adjustmentExplanation: string | null;
  }[];
  const headers = [
    'Product',
    'SKU',
    'Transaction type',
    'Quantity',
    'Warehouse',
    'Location',
    'Reference',
    'Reason',
    'Explanation',
    'Creator',
    'Date',
  ];
  return {
    headers,
    rows: rows.map((row) => ({
      Product: row.productName,
      SKU: row.sku,
      'Transaction type':
        row.type === 'AdjustmentIncrease'
          ? 'Adjustment - Increase'
          : row.type === 'AdjustmentDecrease'
            ? 'Adjustment - Decrease'
            : row.type === 'TransferIn'
              ? 'Transfer - In'
              : row.type === 'TransferOut'
                ? 'Transfer - Out'
                : row.type,
      Quantity: row.quantity,
      Warehouse: row.warehouseName,
      Location: `${row.locationName} (${row.locationCode})`,
      Reference: row.referenceId ?? '',
      Reason: formatAdjustmentReason(row.adjustmentReason),
      Explanation: row.adjustmentExplanation ?? '',
      Creator: row.createdBy,
      Date: formatDate(row.createdAt),
    })),
  };
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function safeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'report';
}

function downloadCsv(kind: ReportKind, headers: string[], rows: DisplayRow[]) {
  const csv = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilePart(kind)}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function Reports() {
  const [kind, setKind] = useState<ReportKind>('stock');
  const [filters, setFilters] = useState<FilterForm>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({});
  const [page, setPage] = useState(1);
  const [filterError, setFilterError] = useState<string>();
  const [isExporting, setIsExporting] = useState(false);
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
  const queryFilters = useMemo(
    () => ({ ...filtersForKind(kind, appliedFilters), page, pageSize }),
    [appliedFilters, kind, page],
  );
  const reportQuery = useQuery({
    queryKey: queryKeys.reports.page(kind, queryFilters),
    queryFn: ({ signal }) =>
      getReportPage<unknown>(kind, queryFilters, signal),
  });
  const locations = useMemo(
    () => locationsQuery.data ?? [],
    [locationsQuery.data],
  );
  const visibleLocations = useMemo(
    () =>
      filters.warehouseId
        ? locations.filter(
            (location: Location) => location.warehouseId === filters.warehouseId,
          )
        : locations,
    [filters.warehouseId, locations],
  );
  const view = displayRows(kind, reportQuery.data?.items ?? []);
  const optionError = [
    productsQuery.isError ? productsQuery.error : undefined,
    warehousesQuery.isError ? warehousesQuery.error : undefined,
    locationsQuery.isError ? locationsQuery.error : undefined,
  ].find((error) => error !== undefined);

  const updateFilter = <K extends keyof FilterForm>(
    field: K,
    value: FilterForm[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      ...(field === 'warehouseId' ? { locationId: '' } : {}),
    }));
  };

  const applyFilters = () => {
    if (
      kind !== 'stock' &&
      filters.startDate &&
      filters.endDate &&
      filters.startDate > filters.endDate
    ) {
      setFilterError('The start date must be earlier than or equal to the end date.');
      return;
    }
    setFilterError(undefined);
    setPage(1);
    const nextFilters = toApiFilters(filters, 1);
    delete nextFilters.page;
    delete nextFilters.pageSize;
    setAppliedFilters(filtersForKind(kind, nextFilters));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setFilterError(undefined);
    setPage(1);
    setAppliedFilters({});
  };

  const exportCsv = async () => {
    setIsExporting(true);
    setFilterError(undefined);
    try {
      const allRows: unknown[] = [];
      let exportPage = 1;
      let totalCount = 0;
      do {
        const result = await getReportPage<unknown>(
          kind,
          {
            ...filtersForKind(kind, appliedFilters),
            page: exportPage,
            pageSize: 100,
          },
        );
        if (result.items.length === 0 && allRows.length < result.totalCount) {
          throw new Error('The report export stopped before all rows were retrieved.');
        }
        allRows.push(...result.items);
        totalCount = result.totalCount;
        exportPage += 1;
      } while (allRows.length < totalCount);
      const csvView = displayRows(kind, allRows);
      downloadCsv(kind, csvView.headers, csvView.rows);
    } catch (error) {
      setFilterError(`Export failed: ${errorMessage(error)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedTab = reportTabs.findIndex((tab) => tab.kind === kind);
  const currentLabel = reportTabs[selectedTab]?.label ?? 'Report';

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
            Reports
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Review and export current stock, movements, receiving, adjustments, transfers, and dispatches.
          </Typography>
        </Box>

        {optionError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Report filters could not be fully loaded: {errorMessage(optionError)}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Tabs
            value={selectedTab}
            onChange={(_, index: number) => {
              setKind(reportTabs[index].kind);
              setPage(1);
              setFilterError(undefined);
            }}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Report types"
          >
            {reportTabs.map((tab) => (
              <Tab key={tab.kind} label={tab.label} />
            ))}
          </Tabs>
        </Paper>

        {filterError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFilterError(undefined)}>
            {filterError}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ mb: 2, p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="report-product-label">Product</InputLabel>
                <Select
                  labelId="report-product-label"
                  label="Product"
                  value={filters.productId}
                  onChange={(event) => updateFilter('productId', event.target.value)}
                >
                  <MenuItem value="">All products</MenuItem>
                  {(productsQuery.data ?? []).map((product) => (
                    <MenuItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="report-warehouse-label">Warehouse</InputLabel>
                <Select
                  labelId="report-warehouse-label"
                  label="Warehouse"
                  value={filters.warehouseId}
                  onChange={(event) => updateFilter('warehouseId', event.target.value)}
                >
                  <MenuItem value="">All warehouses</MenuItem>
                  {(warehousesQuery.data ?? []).map((warehouse) => (
                    <MenuItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="report-location-label">Location</InputLabel>
                <Select
                  labelId="report-location-label"
                  label="Location"
                  value={filters.locationId}
                  onChange={(event) => updateFilter('locationId', event.target.value)}
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
                label="Keyword"
                value={filters.keyword}
                onChange={(event) => updateFilter('keyword', event.target.value)}
              />
            </Stack>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ alignItems: { md: 'center' } }}
            >
              {kind === 'movements' && (
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="report-type-label">Transaction type</InputLabel>
                  <Select
                    labelId="report-type-label"
                    label="Transaction type"
                    value={filters.transactionType}
                    onChange={(event) => updateFilter('transactionType', event.target.value)}
                  >
                    <MenuItem value="">All movements</MenuItem>
                    <MenuItem value="Receipt">Receipt</MenuItem>
                    <MenuItem value="AdjustmentIncrease">Adjustment increase</MenuItem>
                    <MenuItem value="AdjustmentDecrease">Adjustment decrease</MenuItem>
                    <MenuItem value="TransferIn">Transfer in</MenuItem>
                    <MenuItem value="TransferOut">Transfer out</MenuItem>
                    <MenuItem value="Dispatch">Dispatch</MenuItem>
                  </Select>
                </FormControl>
              )}
              {kind !== 'stock' && (
                <>
                  <DateFilterField
                    label="Start date"
                    value={filters.startDate}
                    onChange={(value) => updateFilter('startDate', value)}
                  />
                  <DateFilterField
                    label="End date"
                    value={filters.endDate}
                    onChange={(value) => updateFilter('endDate', value)}
                  />
                </>
              )}
              <Box sx={{ flex: 1 }} />
              <Button variant="outlined" onClick={clearFilters}>
                Clear
              </Button>
              <Button variant="contained" onClick={applyFilters}>
                Apply filters
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {reportQuery.isError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => void reportQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Could not load {currentLabel.toLowerCase()}: {errorMessage(reportQuery.error)}
          </Alert>
        )}

        <Paper variant="outlined">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              p: 2,
              alignItems: { sm: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6">{currentLabel}</Typography>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={() => void exportCsv()}
              disabled={isExporting || reportQuery.isPending}
            >
              {isExporting ? 'Preparing CSV…' : 'Export all filtered rows'}
            </Button>
          </Stack>
          <TableContainer sx={{ maxHeight: 620 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {view.headers.map((header) => (
                    <TableCell key={header} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {reportQuery.isPending ? (
                  <TableRow>
                    <TableCell colSpan={view.headers.length} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={26} aria-label="Loading report" />
                    </TableCell>
                  </TableRow>
                ) : view.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={view.headers.length} align="center" sx={{ py: 6 }}>
                      No report rows match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  view.rows.map((row, index) => (
                    <TableRow hover key={`${kind}-${index}`}>
                      {view.headers.map((header) => (
                        <TableCell key={header} sx={{ whiteSpace: 'nowrap' }}>
                          {typeof row[header] === 'number'
                            ? formatQuantity(row[header] as number)
                            : row[header]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={reportQuery.data?.totalCount ?? 0}
            page={page - 1}
            onPageChange={(_, nextPage) => setPage(nextPage + 1)}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[pageSize]}
          />
        </Paper>
      </Box>
    </Box>
  );
}
