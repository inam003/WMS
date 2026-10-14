import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  TextField,
  Typography,
} from '@mui/material';
import { ToastAlert as Alert } from '../components/ToastProvider';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import { BarcodeScannerButton } from '../components/BarcodeScannerButton';
import { FormFooter, FormSection } from '../components/FormSection';
import { getLocations, getProducts, getWarehouses, transferInventory } from '../lib/api';
import type { InventoryTransferRequest } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

interface TransferFormValues {
  productId: string;
  sourceWarehouseId: string;
  sourceLocationId: string;
  destinationWarehouseId: string;
  destinationLocationId: string;
  quantity: string;
  referenceId: string;
}

interface TransferIntent {
  signature: string;
  idempotencyKey: string;
}

const emptyForm: TransferFormValues = {
  productId: '',
  sourceWarehouseId: '',
  sourceLocationId: '',
  destinationWarehouseId: '',
  destinationLocationId: '',
  quantity: '',
  referenceId: '',
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

const isGuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function WarehouseTransfers() {
  const queryClient = useQueryClient();
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
  const [form, setForm] = useState<TransferFormValues>(emptyForm);
  const [formError, setFormError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const intentRef = useRef<TransferIntent | undefined>(undefined);
  const submissionLock = useRef(false);

  const products = useMemo(
    () => (productsQuery.data ?? []).filter((product) => product.isActive),
    [productsQuery.data],
  );
  const warehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter((warehouse) => warehouse.isActive),
    [warehousesQuery.data],
  );
  const activeWarehouseIds = useMemo(
    () => new Set(warehouses.map((warehouse) => warehouse.id)),
    [warehouses],
  );
  const activeLocations = useMemo(
    () =>
      (locationsQuery.data ?? []).filter(
        (location) => location.isActive && activeWarehouseIds.has(location.warehouseId),
      ),
    [activeWarehouseIds, locationsQuery.data],
  );
  const sourceLocations = useMemo(
    () =>
      activeLocations.filter(
        (location) => !form.sourceWarehouseId || location.warehouseId === form.sourceWarehouseId,
      ),
    [activeLocations, form.sourceWarehouseId],
  );
  const destinationLocations = useMemo(
    () =>
      activeLocations.filter(
        (location) =>
          !form.destinationWarehouseId || location.warehouseId === form.destinationWarehouseId,
      ),
    [activeLocations, form.destinationWarehouseId],
  );
  const optionsError = [
    productsQuery.isError ? productsQuery.error : undefined,
    warehousesQuery.isError ? warehousesQuery.error : undefined,
    locationsQuery.isError ? locationsQuery.error : undefined,
  ].find((error) => error !== undefined);
  const isLoading =
    productsQuery.isPending || warehousesQuery.isPending || locationsQuery.isPending;
  const retryOptions = () =>
    Promise.all([productsQuery.refetch(), warehousesQuery.refetch(), locationsQuery.refetch()]);
  const quantity = Number(form.quantity);
  const isQuantityValid =
    form.quantity.trim().length > 0 &&
    Number.isFinite(quantity) &&
    quantity > 0 &&
    quantity < 1_000_000_000_000_000 &&
    Math.round(quantity * 1000) / 1000 === quantity;
  const isReferenceValid = !form.referenceId.trim() || isGuid(form.referenceId.trim());
  const isTransferFormValid =
    !isLoading &&
    !optionsError &&
    Boolean(form.productId && form.sourceLocationId && form.destinationLocationId) &&
    form.sourceLocationId !== form.destinationLocationId &&
    isQuantityValid &&
    isReferenceValid;
  const transferValidationMessage =
    !form.productId || !form.sourceLocationId || !form.destinationLocationId
      ? 'Select a product, source location, and destination location.'
      : form.sourceLocationId === form.destinationLocationId
        ? 'Source and destination locations must be different.'
        : !isQuantityValid
          ? 'Enter a quantity greater than zero with up to three decimals.'
          : !isReferenceValid
            ? 'Reference ID must be a valid GUID.'
            : undefined;

  const transferMutation = useMutation({
    mutationFn: async ({
      request,
      idempotencyKey,
    }: {
      request: InventoryTransferRequest;
      idempotencyKey: string;
    }) => {
      const transactions = await transferInventory(request, idempotencyKey);
      if (!transactions || transactions.length !== 2) {
        throw new Error('The API did not return both transfer transactions.');
      }
      return transactions;
    },
    onSuccess: async (transactions) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryTransactions.all,
        }),
      ]);
      intentRef.current = undefined;
      setForm(emptyForm);
      const outgoing = transactions.find((transaction) => transaction.type === 'TransferOut');
      const incoming = transactions.find((transaction) => transaction.type === 'TransferIn');
      setSuccessMessage(
        outgoing && incoming
          ? `Transferred ${outgoing.quantity} ${outgoing.productName} from ${outgoing.warehouseName} / ${outgoing.locationName} to ${incoming.warehouseName} / ${incoming.locationName}.`
          : 'The transfer was recorded successfully.',
      );
    },
    onSettled: () => {
      submissionLock.current = false;
    },
  });

  const updateForm = <K extends keyof TransferFormValues>(
    field: K,
    value: TransferFormValues[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(undefined);
    setSuccessMessage(undefined);
  };

  const submitTransfer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionLock.current) return;

    const quantity = Number(form.quantity);
    if (!form.productId || !form.sourceLocationId || !form.destinationLocationId) {
      setFormError('Select a product, source location, and destination location.');
      return;
    }
    if (form.sourceLocationId === form.destinationLocationId) {
      setFormError('Source and destination locations must be different.');
      return;
    }
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity >= 1000000000000000 ||
      Math.round(quantity * 1000) / 1000 !== quantity
    ) {
      setFormError('Quantity must be greater than zero with up to three decimals.');
      return;
    }

    const referenceId = form.referenceId.trim();
    if (referenceId && !isGuid(referenceId)) {
      setFormError('Reference ID must be a valid GUID.');
      return;
    }

    const request: InventoryTransferRequest = {
      productId: form.productId,
      sourceLocationId: form.sourceLocationId,
      destinationLocationId: form.destinationLocationId,
      quantity,
      referenceId: referenceId || null,
    };
    const signature = JSON.stringify(request);
    const idempotencyKey =
      intentRef.current?.signature === signature
        ? intentRef.current.idempotencyKey
        : crypto.randomUUID();
    intentRef.current = { signature, idempotencyKey };
    submissionLock.current = true;
    setFormError(undefined);
    setSuccessMessage(undefined);
    transferMutation.mutate({ request, idempotencyKey });
  };

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: 'center' }}>
          <SwapHorizOutlinedIcon color="primary" fontSize="large" />
          <Box>
            <Typography
              variant="overline"
              color="primary"
              sx={{ fontWeight: 700, letterSpacing: 1.2 }}
            >
              WAREHOUSE OPERATIONS
            </Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              Warehouse transfers
            </Typography>
          </Box>
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Move stock between active locations in the same or different warehouses.
        </Typography>

        {optionsError && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => void retryOptions()}>
                Retry
              </Button>
            }
          >
            Transfer options could not be loaded: {errorMessage(optionsError)}
          </Alert>
        )}
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        {transferMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage(transferMutation.error)}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}

        <Paper
          component="form"
          variant="outlined"
          onSubmit={submitTransfer}
          sx={{ overflow: 'hidden' }}
        >
          {isLoading ? (
            <Stack spacing={2} sx={{ p: 5, alignItems: 'center' }} role="status">
              <CircularProgress size={30} />
              <Typography color="text.secondary">Loading transfer options…</Typography>
            </Stack>
          ) : (
            <>
              <FormSection
                step={1}
                title="Product"
                description="Choose the product to move, or scan its barcode."
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ alignItems: { sm: 'flex-start' } }}
                >
                  <FormControl fullWidth required>
                    <InputLabel id="transfer-product-label">Product</InputLabel>
                    <Select
                      labelId="transfer-product-label"
                      label="Product"
                      value={form.productId}
                      onChange={(event) => updateForm('productId', event.target.value)}
                    >
                      {products.map((product) => (
                        <MenuItem key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <BarcodeScannerButton
                    target="product"
                    variant="outlined"
                    fullHeight
                    label="Scan product"
                    onResolved={(entity) => {
                      if ('sku' in entity) updateForm('productId', entity.id);
                    }}
                  />
                </Stack>
              </FormSection>
              <FormSection step={2} title="Source" description="Where the stock is taken from.">
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { sm: 'flex-start' } }}
                >
                  <FormControl fullWidth required>
                    <InputLabel id="transfer-source-warehouse-label">Source warehouse</InputLabel>
                    <Select
                      labelId="transfer-source-warehouse-label"
                      label="Source warehouse"
                      value={form.sourceWarehouseId}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          sourceWarehouseId: event.target.value,
                          sourceLocationId: '',
                        }));
                        setFormError(undefined);
                        setSuccessMessage(undefined);
                      }}
                    >
                      {warehouses.map((warehouse) => (
                        <MenuItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth required disabled={!form.sourceWarehouseId}>
                    <InputLabel id="transfer-source-location-label">Source location</InputLabel>
                    <Select
                      labelId="transfer-source-location-label"
                      label="Source location"
                      value={form.sourceLocationId}
                      onChange={(event) => updateForm('sourceLocationId', event.target.value)}
                    >
                      {sourceLocations.map((location) => (
                        <MenuItem
                          key={location.id}
                          value={location.id}
                          disabled={location.id === form.destinationLocationId}
                        >
                          {location.name} ({location.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <BarcodeScannerButton
                    target="location"
                    label="Scan source"
                    variant="outlined"
                    fullHeight
                    onResolved={(entity) => {
                      if ('warehouseId' in entity) {
                        setForm((current) => ({
                          ...current,
                          sourceWarehouseId: entity.warehouseId,
                          sourceLocationId: entity.id,
                        }));
                        setFormError(undefined);
                        setSuccessMessage(undefined);
                      }
                    }}
                  />
                </Stack>
              </FormSection>
              <FormSection step={3} title="Destination" description="Where the stock is moved to.">
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { sm: 'flex-start' } }}
                >
                  <FormControl fullWidth required>
                    <InputLabel id="transfer-destination-warehouse-label">
                      Destination warehouse
                    </InputLabel>
                    <Select
                      labelId="transfer-destination-warehouse-label"
                      label="Destination warehouse"
                      value={form.destinationWarehouseId}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          destinationWarehouseId: event.target.value,
                          destinationLocationId: '',
                        }));
                        setFormError(undefined);
                        setSuccessMessage(undefined);
                      }}
                    >
                      {warehouses.map((warehouse) => (
                        <MenuItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth required disabled={!form.destinationWarehouseId}>
                    <InputLabel id="transfer-destination-location-label">
                      Destination location
                    </InputLabel>
                    <Select
                      labelId="transfer-destination-location-label"
                      label="Destination location"
                      value={form.destinationLocationId}
                      onChange={(event) => updateForm('destinationLocationId', event.target.value)}
                    >
                      {destinationLocations.map((location) => (
                        <MenuItem
                          key={location.id}
                          value={location.id}
                          disabled={location.id === form.sourceLocationId}
                        >
                          {location.name} ({location.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <BarcodeScannerButton
                    target="location"
                    label="Scan destination"
                    variant="outlined"
                    fullHeight
                    onResolved={(entity) => {
                      if ('warehouseId' in entity) {
                        setForm((current) => ({
                          ...current,
                          destinationWarehouseId: entity.warehouseId,
                          destinationLocationId: entity.id,
                        }));
                        setFormError(undefined);
                        setSuccessMessage(undefined);
                      }
                    }}
                  />
                </Stack>
              </FormSection>
              <FormSection
                step={4}
                title="Quantity"
                description="Enter how much to move and an optional reference."
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { sm: 'flex-start' } }}
                >
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label="Quantity"
                    value={form.quantity}
                    onChange={(event) => updateForm('quantity', event.target.value)}
                    slotProps={{ htmlInput: { min: 0, step: '0.001' } }}
                  />
                  <TextField
                    fullWidth
                    label="Reference ID (optional)"
                    value={form.referenceId}
                    onChange={(event) => updateForm('referenceId', event.target.value)}
                    helperText="Optional external transfer reference (GUID)."
                    error={!isReferenceValid}
                  />
                </Stack>
              </FormSection>
              <FormFooter message={transferValidationMessage}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!isTransferFormValid || transferMutation.isPending}
                >
                  {transferMutation.isPending ? 'Recording transfer…' : 'Transfer stock'}
                </Button>
              </FormFooter>
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
