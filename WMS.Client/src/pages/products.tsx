import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  InputAdornment,
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
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { DialogTitleWithClose } from '../components/DialogTitleWithClose';
import { BarcodeLabelButton } from '../components/BarcodeLabelButton';
import {
  ApiError,
  createProduct,
  deleteProduct,
  getCategories,
  getProduct,
  getProducts,
  updateProduct,
} from '../lib/api';
import type { Product, ProductRequest } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { generateInternalBarcode } from '../lib/barcode';

interface ProductFormValues {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  unit: string;
  minimumStockLevel: string;
  barcode: string;
  isActive: boolean;
}

type FormMode = { type: 'create' } | { type: 'edit'; product: Product };

const emptyForm: ProductFormValues = {
  sku: '',
  name: '',
  description: '',
  categoryId: '',
  unit: '',
  minimumStockLevel: '0',
  barcode: '',
  isActive: true,
};

const categoryIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumMinimumStockLevel = 999_999_999_999_999;

function formValuesFromProduct(product: Product): ProductFormValues {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? '',
    categoryId: product.categoryId,
    unit: product.unit,
    minimumStockLevel: String(product.minimumStockLevel),
    barcode: product.barcode ?? '',
    isActive: product.isActive,
  };
}

function toProductRequest(values: ProductFormValues): ProductRequest {
  return {
    sku: values.sku.trim(),
    name: values.name.trim(),
    description: values.description.trim() || null,
    categoryId: values.categoryId.trim(),
    unit: values.unit.trim(),
    minimumStockLevel: Number(values.minimumStockLevel),
    barcode: values.barcode.trim() || null,
    isActive: values.isActive,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function Products() {
  const queryClient = useQueryClient();
  const {
    data: products = [],
    isPending: isLoading,
    isError: productsLoadFailed,
    error: loadError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: queryKeys.products.list,
    queryFn: ({ signal }) => getProducts(signal),
  });
  const {
    data: categories = [],
    isPending: isCategoriesLoading,
    isError: categoryLoadFailed,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: ({ signal }) => getCategories(signal),
  });
  const [actionError, setActionError] = useState<string>();
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<FormMode>();
  const [formValues, setFormValues] = useState<ProductFormValues>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [deletingProduct, setDeletingProduct] = useState<Product>();
  const [detailsProduct, setDetailsProduct] = useState<Product>();
  const {
    data: details,
    isPending: detailsQueryPending,
    isError: detailsLoadFailed,
    error: detailsError,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: queryKeys.products.detail(detailsProduct?.id ?? ''),
    queryFn: async ({ signal }) => {
      if (!detailsProduct) {
        throw new Error('A product must be selected to load its details.');
      }
      const result = await getProduct(detailsProduct.id, signal);
      if (!result) {
        throw new Error('The API returned no product details.');
      }
      return result;
    },
    enabled: Boolean(detailsProduct),
  });
  const detailsLoading = Boolean(detailsProduct) && detailsQueryPending;
  const invalidateProductData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.products.list }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryTransactions.all,
      }),
    ]);
  const createMutation = useMutation({
    mutationFn: async (request: ProductRequest) => {
      const created = await createProduct(request);
      if (!created) {
        throw new Error('The API returned no product after creation.');
      }
      return created;
    },
    onSuccess: invalidateProductData,
  });
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      request,
    }: {
      id: string;
      request: ProductRequest;
    }) => {
      const updated = await updateProduct(id, request);
      if (!updated) {
        throw new Error('The API returned no product after the update.');
      }
      return updated;
    },
    onSuccess: async (_updated, variables) => {
      await Promise.all([
        invalidateProductData(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(variables.id),
        }),
      ]);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async (_result, id) => {
      await Promise.all([
        invalidateProductData(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(id),
          exact: true,
          refetchType: 'none',
        }),
      ]);
    },
  });
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [product.sku, product.name, product.barcode ?? '']
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [products, search]);

  const openCreateForm = () => {
    setFormMode({ type: 'create' });
    setFormValues(emptyForm);
    setFormErrors({});
    setActionError(undefined);
  };

  const openEditForm = (product: Product) => {
    setFormMode({ type: 'edit', product });
    setFormValues(formValuesFromProduct(product));
    setFormErrors({});
    setActionError(undefined);
  };

  const updateField = <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => {
      const next = { ...current };
      const errorKey = Object.keys(next).find(
        (key) => key.toLowerCase() === field.toLowerCase(),
      );
      if (errorKey) {
        delete next[errorKey];
      }
      return next;
    });
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(undefined);
    setFormErrors({});

    if (!categoryIdPattern.test(formValues.categoryId.trim())) {
      setFormErrors({ CategoryId: ['Enter a valid Category UUID.'] });
      return;
    }

    const minimumStockLevel = Number(formValues.minimumStockLevel);
    if (
      !Number.isFinite(minimumStockLevel) ||
      minimumStockLevel < 0 ||
      minimumStockLevel > maximumMinimumStockLevel ||
      Math.round(minimumStockLevel * 1000) / 1000 !== minimumStockLevel
    ) {
      setFormErrors({
        MinimumStockLevel: [
          'Enter a non-negative value with no more than 3 decimal places.',
        ],
      });
      return;
    }

    const request = toProductRequest(formValues);
    try {
      if (formMode?.type === 'edit') {
        await updateMutation.mutateAsync({
          id: formMode.product.id,
          request,
        });
      } else {
        await createMutation.mutateAsync(request);
      }
      setFormMode(undefined);
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors) {
        setFormErrors(error.validationErrors);
      }
      setActionError(errorMessage(error));
    }
  };

  const showDetails = (product: Product) => {
    setDetailsProduct(product);
  };

  const removeProduct = async () => {
    if (!deletingProduct) {
      return;
    }

    setActionError(undefined);
    try {
      await deleteMutation.mutateAsync(deletingProduct.id);
      if (detailsProduct?.id === deletingProduct.id) {
        setDetailsProduct(undefined);
      }
      setDeletingProduct(undefined);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  const fieldError = (field: string) =>
    Object.entries(formErrors).find(
      ([key]) => key.toLowerCase() === field.toLowerCase(),
    )?.[1];
  const minimumStockLevel = Number(formValues.minimumStockLevel);
  const minimumStockLevelIsValid =
    formValues.minimumStockLevel.trim().length > 0 &&
    Number.isFinite(minimumStockLevel) &&
    minimumStockLevel >= 0 &&
    minimumStockLevel <= maximumMinimumStockLevel &&
    Math.round(minimumStockLevel * 1000) / 1000 === minimumStockLevel;
  const categoryIdIsValid = categoryIdPattern.test(
    formValues.categoryId.trim(),
  );
  const isFormValid =
    formValues.sku.trim().length > 0 &&
    formValues.sku.trim().length <= 50 &&
    formValues.name.trim().length > 0 &&
    formValues.name.trim().length <= 200 &&
    categoryIdIsValid &&
    formValues.unit.trim().length > 0 &&
    formValues.unit.trim().length <= 50 &&
    minimumStockLevelIsValid &&
    formValues.barcode.trim().length <= 100 &&
    formValues.description.trim().length <= 1000;

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, sm: 3 } }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{
                  mb: 3,
                  alignItems: { xs: 'stretch', sm: 'center' },
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography
                    variant="overline"
                    color="primary"
                    sx={{ fontWeight: 700, letterSpacing: 1.2 }}
                  >
                    CATALOG
                  </Typography>
                  <Typography
                    variant="h4"
                    component="h1"
                    sx={{ fontWeight: 700 }}
                  >
                    Products
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Manage product details, stock thresholds, and status.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreateForm}
                  sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                >
                  Add product
                </Button>
              </Stack>

              {actionError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {actionError}
                </Alert>
              )}

              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{
                    p: 2.5,
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      All products
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {products.length} {products.length === 1 ? 'product' : 'products'}
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search SKU, name, barcode"
                    aria-label="Search products"
                    sx={{ width: { xs: '100%', sm: 320 } }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon color="action" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Stack>

                {isLoading ? (
                  <Stack
                    spacing={2}
                    sx={{
                      py: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    role="status"
                  >
                    <CircularProgress size={30} />
                    <Typography color="text.secondary">
                      Loading products…
                    </Typography>
                  </Stack>
                ) : productsLoadFailed ? (
                  <Stack
                    spacing={2}
                    sx={{ alignItems: 'center', p: 4 }}
                  >
                    <Alert severity="error" sx={{ width: '100%' }}>
                      {errorMessage(loadError)}
                    </Alert>
                    <Button
                      variant="outlined"
                      onClick={() => void refetchProducts()}
                    >
                      Retry
                    </Button>
                  </Stack>
                ) : products.length === 0 ? (
                  <Stack
                    spacing={1.5}
                    sx={{ alignItems: 'center', py: 8, px: 2 }}
                  >
                    <Inventory2OutlinedIcon
                      color="action"
                      sx={{ fontSize: 42 }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      No products yet
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ textAlign: 'center' }}
                    >
                      Create your first product to start building the catalog.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={openCreateForm}
                    >
                      Add your first product
                    </Button>
                  </Stack>
                ) : visibleProducts.length === 0 ? (
                  <Typography
                    color="text.secondary"
                    sx={{ py: 6, px: 2, textAlign: 'center' }}
                  >
                    No products match “{search}”.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell>Category ID</TableCell>
                          <TableCell>Minimum stock</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleProducts.map((product) => (
                          <TableRow hover key={product.id}>
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 650 }}
                              >
                                {product.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {product.barcode || 'No barcode'}
                              </Typography>
                            </TableCell>
                            <TableCell>{product.sku}</TableCell>
                            <TableCell>
                              <Tooltip title={product.categoryId}>
                                <Typography
                                  variant="body2"
                                  noWrap
                                  sx={{ maxWidth: 150 }}
                                >
                                  {categoryNames.get(product.categoryId) ??
                                    product.categoryId}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              {product.minimumStockLevel} {product.unit}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                color={product.isActive ? 'success' : 'default'}
                                label={product.isActive ? 'Active' : 'Inactive'}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Stack
                                direction="row"
                                sx={{ gap: 0.5, justifyContent: 'flex-end' }}
                              >
                                <Tooltip title="View details">
                                  <IconButton
                                    aria-label={`View ${product.name}`}
                                    onClick={() => void showDetails(product)}
                                    size="small"
                                  >
                                    <VisibilityOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit product">
                                  <IconButton
                                    aria-label={`Edit ${product.name}`}
                                    onClick={() => openEditForm(product)}
                                    size="small"
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete product">
                                  <IconButton
                                    aria-label={`Delete ${product.name}`}
                                    color="error"
                                    onClick={() => setDeletingProduct(product)}
                                    size="small"
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <BarcodeLabelButton
                                  title={product.name}
                                  subtitle={`SKU: ${product.sku}`}
                                  barcode={product.barcode}
                                />
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>

              {detailsProduct &&
                (detailsLoading || detailsLoadFailed || details) && (
                <Paper variant="outlined" sx={{ mt: 2.5, p: 2.5 }}>
                  {detailsLoading ? (
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: 'center' }}
                    >
                      <CircularProgress size={20} />
                      <Typography>Loading product details…</Typography>
                    </Stack>
                  ) : detailsLoadFailed ? (
                    <Stack spacing={1.5}>
                      <Alert severity="error">
                        {errorMessage(detailsError)}
                      </Alert>
                      <Button
                        variant="outlined"
                        onClick={() => void refetchDetails()}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Retry
                      </Button>
                    </Stack>
                  ) : details ? (
                    <Stack spacing={2}>
                      <Stack
                        direction="row"
                        sx={{
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Box>
                          <Typography variant="overline" color="primary">
                            PRODUCT DETAILS
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 650 }}>
                            {details.name}
                          </Typography>
                        </Box>
                        <Button onClick={() => setDetailsProduct(undefined)}>
                          Close
                        </Button>
                      </Stack>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, minmax(0, 1fr))',
                            md: 'repeat(3, minmax(0, 1fr))',
                          },
                          gap: 2,
                        }}
                      >
                        <Detail label="SKU" value={details.sku} />
                        <Detail
                          label="Category"
                          value={
                            categoryNames.get(details.categoryId) ??
                            details.categoryId
                          }
                        />
                        <Detail label="Unit" value={details.unit} />
                        <Detail
                          label="Minimum stock"
                          value={String(details.minimumStockLevel)}
                        />
                        <Detail label="Barcode" value={details.barcode || '—'} />
                        <Detail
                          label="Status"
                          value={details.isActive ? 'Active' : 'Inactive'}
                        />
                        <Detail
                          label="Description"
                          value={details.description || '—'}
                        />
                      </Box>
                    </Stack>
                  ) : null}
                </Paper>
              )}
      </Box>

        <Dialog
          open={Boolean(formMode)}
          onClose={() => !isSaving && setFormMode(undefined)}
          fullWidth
          maxWidth="sm"
        >
          <Box component="form" onSubmit={submitForm}>
            <DialogTitleWithClose
              onClose={() => !isSaving && setFormMode(undefined)}
              disabled={isSaving}
            >
              {formMode?.type === 'create' ? 'Add product' : 'Edit product'}
            </DialogTitleWithClose>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {actionError && <Alert severity="error">{actionError}</Alert>}
                <TextField
                  required
                  fullWidth
                  label="SKU"
                  value={formValues.sku}
                  onChange={(event) => updateField('sku', event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 50 } }}
                  error={Boolean(fieldError('SKU'))}
                  helperText={fieldError('SKU')?.join(' ')}
                />
                <TextField
                  required
                  fullWidth
                  label="Product name"
                  value={formValues.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                  error={Boolean(fieldError('Name'))}
                  helperText={fieldError('Name')?.join(' ')}
                />
                {categoryLoadFailed ? (
                  <>
                    <Alert
                      severity="warning"
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => void refetchCategories()}
                        >
                          Retry
                        </Button>
                      }
                    >
                      Categories could not be loaded. Enter an existing Category
                      ID manually or retry.
                    </Alert>
                    <TextField
                      required
                      fullWidth
                      label="Category ID"
                      placeholder="Existing Category UUID"
                      value={formValues.categoryId}
                      onChange={(event) =>
                        updateField('categoryId', event.target.value)
                      }
                      slotProps={{ htmlInput: { maxLength: 36 } }}
                      error={Boolean(fieldError('CategoryId'))}
                      helperText={
                        fieldError('CategoryId')?.join(' ') ??
                        (formValues.categoryId.trim() && !categoryIdIsValid
                          ? 'Enter a valid Category UUID.'
                          : undefined)
                      }
                    />
                  </>
                ) : (
                  <FormControl
                    required
                    fullWidth
                    error={Boolean(fieldError('CategoryId'))}
                    disabled={isCategoriesLoading || categories.length === 0}
                  >
                    <InputLabel id="product-category-label">Category</InputLabel>
                    <Select
                      labelId="product-category-label"
                      label="Category"
                      value={formValues.categoryId}
                      onChange={(event) =>
                        updateField('categoryId', event.target.value)
                      }
                    >
                      {categories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      {fieldError('CategoryId')?.join(' ') ??
                        (isCategoriesLoading
                          ? 'Loading categories…'
                          : categories.length === 0
                            ? 'No categories are available. Create a category before adding products.'
                            : 'Select the product category.')}
                    </FormHelperText>
                  </FormControl>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    required
                    fullWidth
                    label="Unit"
                    value={formValues.unit}
                    onChange={(event) => updateField('unit', event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 50 } }}
                    error={Boolean(fieldError('Unit'))}
                    helperText={fieldError('Unit')?.join(' ')}
                  />
                  <TextField
                    required
                    fullWidth
                    type="number"
                    label="Minimum stock level"
                    value={formValues.minimumStockLevel}
                    onChange={(event) =>
                      updateField('minimumStockLevel', event.target.value)
                    }
                    slotProps={{
                      htmlInput: {
                        min: 0,
                        max: maximumMinimumStockLevel,
                        step: 0.001,
                      },
                    }}
                    error={
                      Boolean(fieldError('MinimumStockLevel')) ||
                      Boolean(
                        formValues.minimumStockLevel &&
                          !minimumStockLevelIsValid,
                      )
                    }
                    helperText={
                      fieldError('MinimumStockLevel')?.join(' ') ??
                      (formValues.minimumStockLevel &&
                      !minimumStockLevelIsValid
                        ? 'Enter a non-negative value with no more than 3 decimal places.'
                        : 'Required; must be non-negative, up to 3 decimal places.')
                    }
                  />
                </Stack>
                <Stack spacing={0.75}>
                  <TextField
                    fullWidth
                    label="Barcode (optional)"
                    value={formValues.barcode}
                    onChange={(event) => updateField('barcode', event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                    error={Boolean(fieldError('Barcode'))}
                    helperText={
                      fieldError('Barcode')?.join(' ') ??
                      'Unique internal Code 128 value. Generated codes are not GS1 registered.'
                    }
                  />
                  <Button
                    size="small"
                    sx={{ alignSelf: 'flex-start' }}
                    onClick={() => updateField('barcode', generateInternalBarcode('product'))}
                  >
                    Generate internal barcode
                  </Button>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Description"
                  value={formValues.description}
                  onChange={(event) =>
                    updateField('description', event.target.value)
                  }
                  slotProps={{ htmlInput: { maxLength: 1000 } }}
                  error={Boolean(fieldError('Description'))}
                  helperText={fieldError('Description')?.join(' ')}
                />
                <Box>
                  <Chip
                    label={formValues.isActive ? 'Active' : 'Inactive'}
                    color={formValues.isActive ? 'success' : 'default'}
                    onClick={() =>
                      updateField('isActive', !formValues.isActive)
                    }
                    aria-pressed={formValues.isActive}
                  />
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button
                onClick={() => setFormMode(undefined)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isSaving || !isFormValid}
                startIcon={
                  isSaving ? <CircularProgress size={16} color="inherit" /> : null
                }
              >
                {isSaving
                  ? 'Saving…'
                  : formMode?.type === 'create'
                    ? 'Create product'
                    : 'Save changes'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>

        <Dialog
          open={Boolean(deletingProduct)}
          onClose={() => !isDeleting && setDeletingProduct(undefined)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitleWithClose
            onClose={() => !isDeleting && setDeletingProduct(undefined)}
            disabled={isDeleting}
          >
            Delete product?
          </DialogTitleWithClose>
          <DialogContent>
            <Typography color="text.secondary">
              Delete {deletingProduct?.name} ({deletingProduct?.sku})? This action
              cannot be undone.
            </Typography>
            {actionError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {actionError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={() => setDeletingProduct(undefined)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => void removeProduct()}
              disabled={isDeleting}
              startIcon={
                isDeleting ? <CircularProgress size={16} color="inherit" /> : null
              }
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block' }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}
