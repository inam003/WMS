import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import {
  adjustInventory,
  getLocations,
  getProducts,
  getWarehouses,
} from '../lib/api';
import type {
  InventoryAdjustmentReason,
  InventoryAdjustmentRequest,
  InventoryAdjustmentType,
} from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

interface AdjustmentFormValues {
  productId: string;
  warehouseId: string;
  locationId: string;
  type: InventoryAdjustmentType | '';
  quantity: string;
  reason: InventoryAdjustmentReason | '';
  explanation: string;
}

interface AdjustmentIntent {
  signature: string;
  idempotencyKey: string;
}

const emptyForm: AdjustmentFormValues = {
  productId: '',
  warehouseId: '',
  locationId: '',
  type: '',
  quantity: '',
  reason: '',
  explanation: '',
};

const reasonLabels: Record<InventoryAdjustmentReason, string> = {
  DamagedStock: 'Damaged stock',
  LostOrMissingStock: 'Lost or missing stock',
  PhysicalCountCorrection: 'Physical count correction',
  Other: 'Other',
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function InventoryAdjustments() {
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
  const [form, setForm] = useState<AdjustmentFormValues>(emptyForm);
  const [formError, setFormError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const intentRef = useRef<AdjustmentIntent | undefined>(undefined);
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
  const locations = useMemo(
    () =>
      (locationsQuery.data ?? []).filter(
        (location) =>
          location.isActive &&
          activeWarehouseIds.has(location.warehouseId) &&
          (!form.warehouseId || location.warehouseId === form.warehouseId),
      ),
    [activeWarehouseIds, form.warehouseId, locationsQuery.data],
  );
  const optionsError = [
    productsQuery.isError ? productsQuery.error : undefined,
    warehousesQuery.isError ? warehousesQuery.error : undefined,
    locationsQuery.isError ? locationsQuery.error : undefined,
  ].find((error) => error !== undefined);
  const isLoading =
    productsQuery.isPending ||
    warehousesQuery.isPending ||
    locationsQuery.isPending;
  const retryOptions = () =>
    Promise.all([
      productsQuery.refetch(),
      warehousesQuery.refetch(),
      locationsQuery.refetch(),
    ]);

  const adjustmentMutation = useMutation({
    mutationFn: async ({
      request,
      idempotencyKey,
    }: {
      request: InventoryAdjustmentRequest;
      idempotencyKey: string;
    }) => {
      const transaction = await adjustInventory(request, idempotencyKey);
      if (!transaction) {
        throw new Error('The API returned no transaction after the adjustment.');
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
      intentRef.current = undefined;
      setForm((current) => ({
        ...current,
        quantity: '',
        reason: '',
        explanation: '',
      }));
      setSuccessMessage(
        `${transaction.type === 'AdjustmentIncrease' ? 'Increased' : 'Decreased'} ${transaction.productName} by ${transaction.quantity}.`,
      );
    },
    onSettled: () => {
      submissionLock.current = false;
    },
  });

  const updateForm = <K extends keyof AdjustmentFormValues>(
    field: K,
    value: AdjustmentFormValues[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(undefined);
    setSuccessMessage(undefined);
  };

  const submitAdjustment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionLock.current) return;

    const quantity = Number(form.quantity);
    if (!form.productId || !form.locationId || !form.type || !form.reason) {
      setFormError('Select a product, location, adjustment type, and reason.');
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

    const explanation = form.explanation.trim();
    if (form.reason === 'Other' && !explanation) {
      setFormError('Provide an explanation when the reason is Other.');
      return;
    }
    if (explanation.length > 500) {
      setFormError('Explanation must be 500 characters or fewer.');
      return;
    }

    const request: InventoryAdjustmentRequest = {
      productId: form.productId,
      locationId: form.locationId,
      type: form.type,
      quantity,
      reason: form.reason,
      explanation: explanation || null,
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
    adjustmentMutation.mutate({ request, idempotencyKey });
  };

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: 'center' }}>
          <TuneOutlinedIcon color="primary" fontSize="large" />
          <Box>
            <Typography
              variant="overline"
              color="primary"
              sx={{ fontWeight: 700, letterSpacing: 1.2 }}
            >
              WAREHOUSE OPERATIONS
            </Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              Inventory adjustments
            </Typography>
          </Box>
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Correct inventory counts for damage, loss, or physical count discrepancies.
          Decreases cannot take stock below zero.
        </Typography>

        {optionsError && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => void retryOptions()}
              >
                Retry
              </Button>
            }
          >
            Adjustment options could not be loaded: {errorMessage(optionsError)}
          </Alert>
        )}
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        {adjustmentMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Adjustment failed: {errorMessage(adjustmentMutation.error)}. Retrying
            the same adjustment reuses its idempotency key.
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}

        <Paper component="form" variant="outlined" onSubmit={submitAdjustment}>
          {isLoading ? (
            <Stack spacing={2} sx={{ p: 5, alignItems: 'center' }} role="status">
              <CircularProgress size={30} />
              <Typography color="text.secondary">
                Loading adjustment options…
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
              <FormControl fullWidth required>
                <InputLabel id="adjustment-product-label">Product</InputLabel>
                <Select
                  labelId="adjustment-product-label"
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
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth required>
                  <InputLabel id="adjustment-warehouse-label">Warehouse</InputLabel>
                  <Select
                    labelId="adjustment-warehouse-label"
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
                  <InputLabel id="adjustment-location-label">Location</InputLabel>
                  <Select
                    labelId="adjustment-location-label"
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
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth required>
                  <InputLabel id="adjustment-type-label">Adjustment type</InputLabel>
                  <Select
                    labelId="adjustment-type-label"
                    label="Adjustment type"
                    value={form.type}
                    onChange={(event) =>
                      updateForm(
                        'type',
                        event.target.value as InventoryAdjustmentType | '',
                      )
                    }
                  >
                    <MenuItem value="Increase">Increase</MenuItem>
                    <MenuItem value="Decrease">Decrease</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Quantity"
                  value={form.quantity}
                  onChange={(event) => updateForm('quantity', event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: '0.001' } }}
                />
              </Stack>
              <FormControl fullWidth required>
                <InputLabel id="adjustment-reason-label">Reason</InputLabel>
                <Select
                  labelId="adjustment-reason-label"
                  label="Reason"
                  value={form.reason}
                  onChange={(event) =>
                    updateForm(
                      'reason',
                      event.target.value as InventoryAdjustmentReason | '',
                    )
                  }
                >
                  {Object.entries(reasonLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
                {form.reason === 'Other' && (
                  <FormHelperText>
                    An explanation is required for Other.
                  </FormHelperText>
                )}
              </FormControl>
              {form.reason === 'Other' && (
                <TextField
                  fullWidth
                  required
                  multiline
                  minRows={2}
                  label="Explanation"
                  value={form.explanation}
                  onChange={(event) =>
                    updateForm('explanation', event.target.value)
                  }
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                />
              )}
              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    isLoading ||
                    Boolean(optionsError) ||
                    adjustmentMutation.isPending
                  }
                >
                  {adjustmentMutation.isPending
                    ? 'Saving adjustment…'
                    : 'Save adjustment'}
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
