import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import {
  cancelOrder,
  createOrder,
  dispatchOrder,
  getInventory,
  getLocations,
  getOrders,
  getProducts,
  getWarehouses,
  markOrderReady,
  updateOrder,
} from '../lib/api';
import type {
  CustomerOrder,
  OrderDispatchRequest,
  OrderRequest,
} from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

interface OrderFormLine {
  productId: string;
  quantity: string;
}

interface OrderFormValues {
  customerName: string;
  referenceId: string;
  lines: OrderFormLine[];
}

interface DispatchSelection {
  warehouseId: string;
  locationId: string;
}

interface DispatchIntent {
  signature: string;
  key: string;
}

const emptyForm: OrderFormValues = {
  customerName: '',
  referenceId: '',
  lines: [{ productId: '', quantity: '' }],
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toOrderRequest(form: OrderFormValues): OrderRequest | null {
  const customerName = form.customerName.trim();
  const referenceId = form.referenceId.trim();
  const lines = form.lines.map((line) => ({
    productId: line.productId,
    quantity: Number(line.quantity),
  }));

  if (customerName.length > 200) {
    throw new Error('Customer name must be 200 characters or fewer.');
  }
  if (referenceId && !isGuid(referenceId)) {
    throw new Error('Reference must be a valid GUID.');
  }
  if (
    lines.length === 0 ||
    lines.some(
      (line) =>
        !line.productId ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0 ||
        line.quantity >= 1_000_000_000_000_000 ||
        Math.round(line.quantity * 1000) / 1000 !== line.quantity,
    )
  ) {
    throw new Error('Add at least one product with a positive quantity of up to three decimals.');
  }
  if (new Set(lines.map((line) => line.productId)).size !== lines.length) {
    throw new Error('Each product can only appear once in an order.');
  }

  return {
    customerName: customerName || null,
    referenceId: referenceId || null,
    lines,
  };
}

export function Orders() {
  const queryClient = useQueryClient();
  const ordersQuery = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: ({ signal }) => getOrders(signal),
  });
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
  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory.list({}),
    queryFn: ({ signal }) => getInventory({}, signal),
  });

  const orders = ordersQuery.data ?? [];
  const products = useMemo(
    () => (productsQuery.data ?? []).filter((product) => product.isActive),
    [productsQuery.data],
  );
  const warehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter((warehouse) => warehouse.isActive),
    [warehousesQuery.data],
  );
  const locations = useMemo(
    () =>
      (locationsQuery.data ?? []).filter(
        (location) =>
          location.isActive &&
          warehouses.some((warehouse) => warehouse.id === location.warehouseId),
      ),
    [locationsQuery.data, warehouses],
  );

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const [form, setForm] = useState<OrderFormValues>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [dispatchSelections, setDispatchSelections] = useState<
    Record<string, DispatchSelection>
  >({});
  const dispatchIntent = useRef<DispatchIntent | undefined>(undefined);
  const submissionLock = useRef(false);

  const invalidateOrderAndStock = async (order?: CustomerOrder) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
      order
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.orders.detail(order.id),
          })
        : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryTransactions.all,
      }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      id,
      request,
    }: {
      id?: string;
      request: OrderRequest;
    }) => (id ? updateOrder(id, request) : createOrder(request)),
    onSuccess: async (order) => {
      if (order) {
        setSelectedOrderId(order.id);
        setMessage(`${order.orderNumber} saved as Draft.`);
      }
      setEditing(false);
      setFormError(undefined);
      await invalidateOrderAndStock(order ?? undefined);
    },
  });
  const readyMutation = useMutation({
    mutationFn: markOrderReady,
    onSuccess: async (order) => {
      setMessage(order ? `${order.orderNumber} is Ready for dispatch.` : 'Order marked Ready.');
      await invalidateOrderAndStock(order ?? undefined);
    },
  });
  const cancelMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: async (order) => {
      setMessage(order ? `${order.orderNumber} was cancelled.` : 'Order cancelled.');
      await invalidateOrderAndStock(order ?? undefined);
    },
  });
  const dispatchMutation = useMutation({
    mutationFn: async ({
      orderId,
      request,
      key,
    }: {
      orderId: string;
      request: OrderDispatchRequest;
      key: string;
    }) => dispatchOrder(orderId, request, key),
    onSuccess: async (transactions) => {
      dispatchIntent.current = undefined;
      const order = selectedOrder;
      setMessage(
        order
          ? `${order.orderNumber} dispatched; ${transactions.length} stock movement${transactions.length === 1 ? '' : 's'} recorded.`
          : 'Order dispatched successfully.',
      );
      await invalidateOrderAndStock(order);
    },
    onSettled: () => {
      submissionLock.current = false;
    },
  });

  const error = [
    ordersQuery.isError ? ordersQuery.error : undefined,
    productsQuery.isError ? productsQuery.error : undefined,
    warehousesQuery.isError ? warehousesQuery.error : undefined,
    locationsQuery.isError ? locationsQuery.error : undefined,
    inventoryQuery.isError ? inventoryQuery.error : undefined,
    saveMutation.isError ? saveMutation.error : undefined,
    readyMutation.isError ? readyMutation.error : undefined,
    cancelMutation.isError ? cancelMutation.error : undefined,
    dispatchMutation.isError ? dispatchMutation.error : undefined,
  ].find((value) => value !== undefined);
  const isLoading =
    ordersQuery.isPending ||
    productsQuery.isPending ||
    warehousesQuery.isPending ||
    locationsQuery.isPending ||
    inventoryQuery.isPending;

  const beginCreate = () => {
    setSelectedOrderId('');
    setEditing(true);
    setForm(emptyForm);
    setFormError(undefined);
    setMessage(undefined);
  };

  const beginEdit = (order: CustomerOrder) => {
    setSelectedOrderId(order.id);
    setEditing(true);
    setForm({
      customerName: order.customerName ?? '',
      referenceId: order.referenceId ?? '',
      lines: order.lines.map((line) => ({
        productId: line.productId,
        quantity: String(line.quantity),
      })),
    });
    setFormError(undefined);
    setMessage(undefined);
  };

  const submitOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(undefined);
    try {
      const request = toOrderRequest(form);
      if (!request) return;
      saveMutation.mutate({
        id: editing && selectedOrder?.status === 'Draft' ? selectedOrder.id : undefined,
        request,
      });
    } catch (validationError) {
      setFormError(errorMessage(validationError));
    }
  };

  const selectOrder = (order: CustomerOrder) => {
    setSelectedOrderId(order.id);
    setEditing(false);
    setMessage(undefined);
    setDispatchSelections(
      Object.fromEntries(
        order.lines.map((line) => [
          line.id,
          {
            warehouseId: '',
            locationId: '',
          },
        ]),
      ),
    );
  };

  const updateDispatchSelection = (
    lineId: string,
    field: keyof DispatchSelection,
    value: string,
  ) => {
    setDispatchSelections((current) => ({
      ...current,
      [lineId]: {
        warehouseId: field === 'warehouseId' ? value : current[lineId]?.warehouseId ?? '',
        locationId: field === 'locationId' ? value : '',
      },
    }));
    setMessage(undefined);
  };

  const submitDispatch = () => {
    if (!selectedOrder || submissionLock.current) return;
    const lines = selectedOrder.lines.map((line) => ({
      orderLineId: line.id,
      locationId: dispatchSelections[line.id]?.locationId ?? '',
    }));
    if (lines.some((line) => !line.locationId)) {
      setFormError('Choose a source location with sufficient inventory for every line.');
      return;
    }

    const request: OrderDispatchRequest = { lines };
    const signature = JSON.stringify({ orderId: selectedOrder.id, request });
    const key =
      dispatchIntent.current?.signature === signature
        ? dispatchIntent.current.key
        : crypto.randomUUID();
    dispatchIntent.current = { signature, key };
    submissionLock.current = true;
    setFormError(undefined);
    setMessage(undefined);
    dispatchMutation.mutate({ orderId: selectedOrder.id, request, key });
  };

  const stockLocationsForLine = (productId: string, quantity: number) =>
    locations.filter((location) =>
      (inventoryQuery.data ?? []).some(
        (record) =>
          record.productId === productId &&
          record.locationId === location.id &&
          record.quantity >= quantity,
      ),
    );

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3 } }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 3, alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <ShoppingCartOutlinedIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
                WAREHOUSE OPERATIONS
              </Typography>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                Orders
              </Typography>
            </Box>
          </Stack>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={beginCreate}>
            New order
          </Button>
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Create customer orders, prepare them for fulfillment, and dispatch stock from selected locations.
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  void Promise.all([
                    ordersQuery.refetch(),
                    productsQuery.refetch(),
                    warehousesQuery.refetch(),
                    locationsQuery.refetch(),
                    inventoryQuery.refetch(),
                  ]);
                }}
              >
                Retry
              </Button>
            }
          >
            {errorMessage(error)}
            {dispatchMutation.isError && ' Retrying the same dispatch reuses its idempotency key.'}
          </Alert>
        )}
        {formError && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setFormError(undefined)}>
            {formError}
          </Alert>
        )}
        {message && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(undefined)}>
            {message}
          </Alert>
        )}
        {isLoading ? (
          <Stack spacing={2} sx={{ py: 7, alignItems: 'center' }} role="status">
            <CircularProgress />
            <Typography color="text.secondary">Loading orders and dispatch options…</Typography>
          </Stack>
        ) : (
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Order history
                </Typography>
                {orders.length === 0 ? (
                  <Typography color="text.secondary">No orders have been created.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {orders.map((order) => (
                      <Button
                        key={order.id}
                        onClick={() => selectOrder(order)}
                        variant={selectedOrderId === order.id ? 'contained' : 'text'}
                        color={selectedOrderId === order.id ? 'primary' : 'inherit'}
                        sx={{
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          py: 1.25,
                          px: 1.5,
                          textTransform: 'none',
                        }}
                      >
                        <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {order.orderNumber}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.75 }}>
                            {order.customerName || 'No customer'} · {order.lines.length} line(s)
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={order.status}
                          color={
                            order.status === 'Dispatched'
                              ? 'success'
                              : order.status === 'Ready'
                                ? 'warning'
                                : order.status === 'Cancelled'
                                  ? 'default'
                                  : 'info'
                          }
                          variant={selectedOrderId === order.id ? 'filled' : 'outlined'}
                        />
                      </Button>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              {(editing || selectedOrder) && (
                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
                  {editing ? (
                    <Box component="form" onSubmit={submitOrder}>
                      <Stack spacing={2.5}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {selectedOrder ? `Edit ${selectedOrder.orderNumber}` : 'Create order'}
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                          <TextField
                            fullWidth
                            label="Customer name (optional)"
                            value={form.customerName}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, customerName: event.target.value }))
                            }
                            slotProps={{ htmlInput: { maxLength: 200 } }}
                          />
                          <TextField
                            fullWidth
                            label="Reference GUID (optional)"
                            value={form.referenceId}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, referenceId: event.target.value }))
                            }
                          />
                        </Stack>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Product lines
                        </Typography>
                        {form.lines.map((line, index) => (
                          <Stack
                            key={`${index}-${line.productId}`}
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.5}
                            sx={{ alignItems: { sm: 'center' } }}
                          >
                            <FormControl fullWidth required>
                              <InputLabel id={`order-product-${index}-label`}>Product</InputLabel>
                              <Select
                                labelId={`order-product-${index}-label`}
                                label="Product"
                                value={line.productId}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    lines: current.lines.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, productId: event.target.value }
                                        : item,
                                    ),
                                  }))
                                }
                              >
                                {products.map((product) => (
                                  <MenuItem key={product.id} value={product.id}>
                                    {product.name} ({product.sku})
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <TextField
                              required
                              label="Quantity"
                              type="number"
                              value={line.quantity}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  lines: current.lines.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, quantity: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
                              sx={{ minWidth: { sm: 150 } }}
                            />
                            <IconButton
                              aria-label={`Remove product line ${index + 1}`}
                              disabled={form.lines.length === 1}
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  lines: current.lines.filter((_, itemIndex) => itemIndex !== index),
                                }))
                              }
                            >
                              <DeleteOutlineIcon />
                            </IconButton>
                          </Stack>
                        ))}
                        <Stack direction="row" spacing={1}>
                          <Button
                            startIcon={<AddOutlinedIcon />}
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                lines: [...current.lines, { productId: '', quantity: '' }],
                              }))
                            }
                          >
                            Add line
                          </Button>
                        </Stack>
                        <Stack direction="row" spacing={1.5}>
                          <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? 'Saving…' : 'Save draft'}
                          </Button>
                          <Button
                            onClick={() => {
                              setEditing(false);
                              setFormError(undefined);
                            }}
                          >
                            Close
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  ) : selectedOrder ? (
                    <Stack spacing={2.5}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
                      >
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {selectedOrder.orderNumber}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {selectedOrder.customerName || 'No customer'} · Created {formatDate(selectedOrder.createdAt)}
                          </Typography>
                        </Box>
                        <Chip label={selectedOrder.status} color="primary" variant="outlined" />
                      </Stack>
                      {selectedOrder.referenceId && (
                        <Typography variant="body2" color="text.secondary">
                          Reference: {selectedOrder.referenceId}
                        </Typography>
                      )}
                      <Stack spacing={1}>
                        {selectedOrder.lines.map((line) => (
                          <Paper key={line.id} variant="outlined" sx={{ p: 1.5 }}>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                              sx={{ justifyContent: 'space-between' }}
                            >
                              <Typography sx={{ fontWeight: 650 }}>
                                {line.productName} ({line.sku})
                              </Typography>
                              <Typography color="text.secondary">
                                Requested: {line.quantity}
                              </Typography>
                            </Stack>
                            {line.dispatchLocationName && (
                              <Typography variant="body2" color="text.secondary">
                                Dispatched from {line.dispatchWarehouseName} / {line.dispatchLocationName}
                              </Typography>
                            )}
                          </Paper>
                        ))}
                      </Stack>
                      {selectedOrder.status === 'Ready' && (
                        <Stack spacing={1.5}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Dispatch source locations
                          </Typography>
                          {selectedOrder.lines.map((line) => {
                            const stockedLocations = stockLocationsForLine(line.productId, line.quantity);
                            const allowedWarehouses = warehouses.filter((warehouse) =>
                              stockedLocations.some((location) => location.warehouseId === warehouse.id),
                            );
                            const selection = dispatchSelections[line.id] ?? {
                              warehouseId: '',
                              locationId: '',
                            };
                            const availableLocations = stockedLocations.filter(
                              (location) => location.warehouseId === selection.warehouseId,
                            );

                            return (
                              <Stack
                                key={line.id}
                                spacing={1}
                                direction={{ xs: 'column', sm: 'row' }}
                                sx={{ alignItems: { sm: 'center' } }}
                              >
                                <Typography sx={{ minWidth: { sm: 180 }, flex: 1 }}>
                                  {line.productName} · {line.quantity}
                                </Typography>
                                <FormControl fullWidth size="small">
                                  <InputLabel id={`dispatch-warehouse-${line.id}`}>Warehouse</InputLabel>
                                  <Select
                                    labelId={`dispatch-warehouse-${line.id}`}
                                    label="Warehouse"
                                    value={selection.warehouseId}
                                    onChange={(event) =>
                                      updateDispatchSelection(line.id, 'warehouseId', event.target.value)
                                    }
                                  >
                                    {allowedWarehouses.map((warehouse) => (
                                      <MenuItem key={warehouse.id} value={warehouse.id}>
                                        {warehouse.name} ({warehouse.code})
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                <FormControl fullWidth size="small" disabled={!selection.warehouseId}>
                                  <InputLabel id={`dispatch-location-${line.id}`}>Location</InputLabel>
                                  <Select
                                    labelId={`dispatch-location-${line.id}`}
                                    label="Location"
                                    value={selection.locationId}
                                    onChange={(event) =>
                                      updateDispatchSelection(line.id, 'locationId', event.target.value)
                                    }
                                  >
                                    {availableLocations.map((location) => (
                                      <MenuItem key={location.id} value={location.id}>
                                        {location.name} ({location.code})
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Stack>
                            );
                          })}
                          <Button
                            variant="contained"
                            onClick={submitDispatch}
                            disabled={dispatchMutation.isPending}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            {dispatchMutation.isPending ? 'Dispatching…' : 'Dispatch order'}
                          </Button>
                        </Stack>
                      )}
                      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                        {selectedOrder.status === 'Draft' && (
                          <>
                            <Button variant="outlined" onClick={() => beginEdit(selectedOrder)}>
                              Edit draft
                            </Button>
                            <Button
                              variant="contained"
                              onClick={() => readyMutation.mutate(selectedOrder.id)}
                              disabled={readyMutation.isPending}
                            >
                              Mark Ready
                            </Button>
                          </>
                        )}
                        {(selectedOrder.status === 'Draft' || selectedOrder.status === 'Ready') && (
                          <Button
                            color="error"
                            onClick={() => cancelMutation.mutate(selectedOrder.id)}
                            disabled={cancelMutation.isPending}
                          >
                            Cancel order
                          </Button>
                        )}
                        {selectedOrder.status === 'Dispatched' && selectedOrder.dispatchedAt && (
                          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                            Dispatched {formatDate(selectedOrder.dispatchedAt)}
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  ) : null}
                </Paper>
              )}
            </Grid>
          </Grid>
        )}
      </Box>
    </Box>
  );
}
