import { useMemo, useState } from 'react';
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
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import { BarcodeScannerButton } from '../components/BarcodeScannerButton';
import { FormFooter, FormSection } from '../components/FormSection';
import { getLocations, getProducts, getWarehouses, receiveInventory } from '../lib/api';
import type { InventoryReceiptRequest } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

interface ReceiptFormValues {
  productId: string;
  warehouseId: string;
  locationId: string;
  quantity: string;
  referenceId: string;
}

interface ReceiptIntent {
  signature: string;
  idempotencyKey: string;
}

const emptyForm: ReceiptFormValues = {
  productId: '',
  warehouseId: '',
  locationId: '',
  quantity: '',
  referenceId: '',
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function Receiving() {
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
  const [form, setForm] = useState<ReceiptFormValues>(emptyForm);
  const [formError, setFormError] = useState<string>();
  const [intent, setIntent] = useState<ReceiptIntent>();
  const [successMessage, setSuccessMessage] = useState<string>();

  const products = useMemo(
    () => (productsQuery.data ?? []).filter((product) => product.isActive),
    [productsQuery.data],
  );
  const warehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter((warehouse) => warehouse.isActive),
    [warehousesQuery.data],
  );
  const warehouseIds = useMemo(
    () => new Set(warehouses.map((warehouse) => warehouse.id)),
    [warehouses],
  );
  const locations = useMemo(
    () =>
      (locationsQuery.data ?? []).filter(
        (location) =>
          location.isActive &&
          warehouseIds.has(location.warehouseId) &&
          (!form.warehouseId || location.warehouseId === form.warehouseId),
      ),
    [form.warehouseId, locationsQuery.data, warehouseIds],
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
  const isReceiptFormValid =
    !isLoading &&
    !optionsError &&
    Boolean(form.productId && form.locationId) &&
    isQuantityValid &&
    isReferenceValid;
  const receiptValidationMessage =
    !form.productId || !form.locationId
      ? 'Select a product and receiving location.'
      : !isQuantityValid
        ? 'Enter a quantity greater than zero with up to three decimals.'
        : !isReferenceValid
          ? 'Reference ID must be a valid GUID.'
          : undefined;

  const receiptMutation = useMutation({
    mutationFn: async ({
      request,
      idempotencyKey,
    }: {
      request: InventoryReceiptRequest;
      idempotencyKey: string;
    }) => {
      const transaction = await receiveInventory(request, idempotencyKey);
      if (!transaction) {
        throw new Error('The API returned no transaction after the receipt.');
      }
      return transaction;
    },
    onSuccess: async (transaction) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryTransactions.all,
        }),
      ]);
      setForm(emptyForm);
      setIntent(undefined);
      setSuccessMessage(
        `Received ${transaction.quantity} ${transaction.productName} at ${transaction.locationName}.`,
      );
    },
  });

  const updateForm = <K extends keyof ReceiptFormValues>(field: K, value: ReceiptFormValues[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(undefined);
    setSuccessMessage(undefined);
  };

  const submitReceipt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (!form.productId || !form.locationId) {
      setFormError('Select a product and receiving location.');
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
    if (
      referenceId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referenceId)
    ) {
      setFormError('Reference ID must be a valid GUID.');
      return;
    }

    const request: InventoryReceiptRequest = {
      productId: form.productId,
      locationId: form.locationId,
      quantity,
      referenceId: referenceId || null,
    };
    const signature = JSON.stringify(request);
    const idempotencyKey =
      intent?.signature === signature ? intent.idempotencyKey : crypto.randomUUID();
    setIntent({ signature, idempotencyKey });
    setFormError(undefined);
    setSuccessMessage(undefined);
    receiptMutation.mutate({ request, idempotencyKey });
  };

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: 'center' }}>
          <MoveToInboxOutlinedIcon color="primary" fontSize="large" />
          <Box>
            <Typography
              variant="overline"
              color="primary"
              sx={{ fontWeight: 700, letterSpacing: 1.2 }}
            >
              WAREHOUSE OPERATIONS
            </Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              Receive stock
            </Typography>
          </Box>
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Record a receipt for one product and add the quantity to a warehouse location.
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
            Receiving options could not be loaded: {errorMessage(optionsError)}
          </Alert>
        )}
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        {receiptMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage(receiptMutation.error)}
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
          onSubmit={submitReceipt}
          sx={{ overflow: 'hidden' }}
        >
          {isLoading ? (
            <Stack spacing={2} sx={{ p: 5, alignItems: 'center' }} role="status">
              <CircularProgress size={30} />
              <Typography color="text.secondary">Loading receiving options…</Typography>
            </Stack>
          ) : (
            <>
              <FormSection
                step={1}
                title="Product"
                description="Choose the product being received, or scan its barcode."
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ alignItems: { sm: 'flex-start' } }}
                >
                  <FormControl fullWidth required>
                    <InputLabel id="receipt-product-label">Product</InputLabel>
                    <Select
                      labelId="receipt-product-label"
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
              <FormSection
                step={2}
                title="Location"
                description="Pick the warehouse and the exact location where the stock is placed."
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { sm: 'flex-start' } }}
                >
                  <FormControl fullWidth required>
                    <InputLabel id="receipt-warehouse-label">Warehouse</InputLabel>
                    <Select
                      labelId="receipt-warehouse-label"
                      label="Warehouse"
                      value={form.warehouseId}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          warehouseId: event.target.value,
                          locationId: '',
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
                  <FormControl fullWidth required disabled={!form.warehouseId}>
                    <InputLabel id="receipt-location-label">Location</InputLabel>
                    <Select
                      labelId="receipt-location-label"
                      label="Location"
                      value={form.locationId}
                      onChange={(event) => updateForm('locationId', event.target.value)}
                    >
                      {locations.map((location) => (
                        <MenuItem key={location.id} value={location.id}>
                          {location.name} ({location.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <BarcodeScannerButton
                    target="location"
                    variant="outlined"
                    fullHeight
                    label="Scan location"
                    onResolved={(entity) => {
                      if ('warehouseId' in entity) {
                        setForm((current) => ({
                          ...current,
                          warehouseId: entity.warehouseId,
                          locationId: entity.id,
                        }));
                        setFormError(undefined);
                        setSuccessMessage(undefined);
                      }
                    }}
                  />
                </Stack>
              </FormSection>
              <FormSection
                step={3}
                title="Quantity"
                description="Enter how much was received and an optional reference."
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
                    helperText="Optional external receipt reference (GUID)."
                    error={!isReferenceValid}
                  />
                </Stack>
              </FormSection>
              <FormFooter message={receiptValidationMessage}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!isReceiptFormValid || receiptMutation.isPending}
                >
                  {receiptMutation.isPending ? 'Recording receipt…' : 'Record receipt'}
                </Button>
              </FormFooter>
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
