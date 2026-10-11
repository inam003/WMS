import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  IconButton,
  Paper,
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
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { DialogTitleWithClose } from '../components/DialogTitleWithClose';
import {
  ApiError,
  createWarehouse,
  deleteWarehouse,
  getWarehouses,
  updateWarehouse,
} from '../lib/api';
import type { Warehouse, WarehouseRequest } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { useWmsAccess } from '../hooks/useWmsAccess';
import { isMasterDataManager } from '../lib/wmsPermissions';

interface WarehouseFormValues {
  name: string;
  code: string;
  address: string;
  isActive: boolean;
}

type FormMode = { type: 'create' } | { type: 'edit'; warehouse: Warehouse };

const emptyForm: WarehouseFormValues = {
  name: '',
  code: '',
  address: '',
  isActive: true,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function Warehouses() {
  const canManage = isMasterDataManager(useWmsAccess().role);
  const queryClient = useQueryClient();
  const {
    data: warehouses = [],
    isPending: isLoading,
    isError,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.warehouses.all,
    queryFn: ({ signal }) => getWarehouses(signal),
  });
  const [actionError, setActionError] = useState<string>();
  const [formMode, setFormMode] = useState<FormMode>();
  const [formValues, setFormValues] = useState<WarehouseFormValues>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse>();
  const invalidateWarehouseData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryTransactions.all,
      }),
    ]);
  const createMutation = useMutation({
    mutationFn: async (request: WarehouseRequest) => {
      const warehouse = await createWarehouse(request);
      if (!warehouse) {
        throw new Error('The API returned no warehouse after creation.');
      }
      return warehouse;
    },
    onSuccess: invalidateWarehouseData,
  });
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      request,
    }: {
      id: string;
      request: WarehouseRequest;
    }) => {
      const warehouse = await updateWarehouse(id, request);
      if (!warehouse) {
        throw new Error('The API returned no warehouse after the update.');
      }
      return warehouse;
    },
    onSuccess: invalidateWarehouseData,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteWarehouse,
    onSuccess: invalidateWarehouseData,
  });
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  const openCreateForm = () => {
    setFormValues(emptyForm);
    setFormErrors({});
    setActionError(undefined);
    setFormMode({ type: 'create' });
  };

  const openEditForm = (warehouse: Warehouse) => {
    setFormValues({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address ?? '',
      isActive: warehouse.isActive,
    });
    setFormErrors({});
    setActionError(undefined);
    setFormMode({ type: 'edit', warehouse });
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(undefined);
    setFormErrors({});
    const errors: Record<string, string[]> = {};
    const name = formValues.name.trim();
    const code = formValues.code.trim();
    const address = formValues.address.trim();
    if (!name) errors.Name = ['Name is required.'];
    else if (name.length > 200) errors.Name = ['Name must be 200 characters or fewer.'];
    if (!code) errors.Code = ['Code is required.'];
    else if (code.length > 50) errors.Code = ['Code must be 50 characters or fewer.'];
    if (address.length > 500) {
      errors.Address = ['Address must be 500 characters or fewer.'];
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const request: WarehouseRequest = {
      name,
      code,
      address: address || null,
      isActive: formValues.isActive,
    };
    try {
      if (formMode?.type === 'edit') {
        await updateMutation.mutateAsync({
          id: formMode.warehouse.id,
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

  const removeWarehouse = async () => {
    if (!deletingWarehouse) return;
    setActionError(undefined);
    try {
      await deleteMutation.mutateAsync(deletingWarehouse.id);
      setDeletingWarehouse(undefined);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  const fieldError = (field: string) =>
    Object.entries(formErrors).find(
      ([key]) => key.toLowerCase() === field.toLowerCase(),
    )?.[1];
  const isFormValid =
    formValues.name.trim().length > 0 &&
    formValues.name.trim().length <= 200 &&
    formValues.code.trim().length > 0 &&
    formValues.code.trim().length <= 50 &&
    formValues.address.trim().length <= 500;

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
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
                    WAREHOUSE OPERATIONS
                  </Typography>
                  <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                    Warehouses
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Manage warehouse locations and operating status.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreateForm}
                  disabled={!canManage}
                  sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                >
                  Add warehouse
                </Button>
              </Stack>

              {actionError && !deletingWarehouse && (
                <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>
              )}
              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack direction="row" sx={{ p: 2.5, justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      All warehouses
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {warehouses.length} {warehouses.length === 1 ? 'warehouse' : 'warehouses'}
                    </Typography>
                  </Box>
                </Stack>
                {isLoading ? (
                  <Stack spacing={2} sx={{ py: 8, alignItems: 'center' }} role="status">
                    <CircularProgress size={30} />
                    <Typography color="text.secondary">Loading warehouses…</Typography>
                  </Stack>
                ) : isError ? (
                  <Stack spacing={2} sx={{ alignItems: 'center', p: 4 }}>
                    <Alert severity="error" sx={{ width: '100%' }}>
                      {errorMessage(loadError)}
                    </Alert>
                    <Button variant="outlined" onClick={() => void refetch()}>
                      Retry
                    </Button>
                  </Stack>
                ) : warehouses.length === 0 ? (
                  <Stack spacing={1.5} sx={{ alignItems: 'center', py: 8, px: 2 }}>
                    <WarehouseOutlinedIcon color="action" sx={{ fontSize: 42 }} />
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      No warehouses yet
                    </Typography>
                    <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                      Create a warehouse to begin organizing storage locations.
                    </Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateForm} disabled={!canManage}>
                      Add your first warehouse
                    </Button>
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Warehouse</TableCell>
                          <TableCell>Code</TableCell>
                          <TableCell>Address</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {warehouses.map((warehouse) => (
                          <TableRow hover key={warehouse.id}>
                            <TableCell>{warehouse.name}</TableCell>
                            <TableCell>{warehouse.code}</TableCell>
                            <TableCell>{warehouse.address || '—'}</TableCell>
                            <TableCell>{warehouse.isActive ? 'Active' : 'Inactive'}</TableCell>
                            <TableCell align="right">
                              <Tooltip title="Edit warehouse">
                                <IconButton
                                  aria-label={`Edit ${warehouse.name}`}
                                  onClick={() => openEditForm(warehouse)}
                                  disabled={!canManage}
                                >
                                  <EditOutlinedIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete warehouse">
                                <IconButton
                                  aria-label={`Delete ${warehouse.name}`}
                                  color="error"
                                  onClick={() => {
                                    setActionError(undefined);
                                    setDeletingWarehouse(warehouse);
                                  }}
                                  disabled={!canManage}
                                >
                                  <DeleteOutlineIcon />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
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
              {formMode?.type === 'create' ? 'Add warehouse' : 'Edit warehouse'}
            </DialogTitleWithClose>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {actionError && <Alert severity="error">{actionError}</Alert>}
                <TextField
                  required
                  label="Warehouse name"
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, name: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                  error={Boolean(fieldError('Name'))}
                  helperText={fieldError('Name')?.join(' ')}
                />
                <TextField
                  required
                  label="Code"
                  value={formValues.code}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, code: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 50 } }}
                  error={Boolean(fieldError('Code'))}
                  helperText={fieldError('Code')?.join(' ')}
                />
                <TextField
                  multiline
                  minRows={2}
                  label="Address"
                  value={formValues.address}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, address: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                  error={Boolean(fieldError('Address'))}
                  helperText={fieldError('Address')?.join(' ')}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formValues.isActive}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          isActive: event.target.checked,
                        }))
                      }
                    />
                  }
                  label="Active"
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setFormMode(undefined)} disabled={isSaving}>Cancel</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={!canManage || isSaving || !isFormValid}
              >
                {isSaving ? 'Saving…' : formMode?.type === 'create' ? 'Create warehouse' : 'Save changes'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
        <Dialog
          open={canManage && Boolean(deletingWarehouse)}
          onClose={() => !isDeleting && setDeletingWarehouse(undefined)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitleWithClose
            onClose={() => !isDeleting && setDeletingWarehouse(undefined)}
            disabled={isDeleting}
          >
            Delete warehouse?
          </DialogTitleWithClose>
          <DialogContent>
            <Typography color="text.secondary">
              Delete {deletingWarehouse?.name}? Warehouses with locations cannot be deleted.
            </Typography>
            {actionError && <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDeletingWarehouse(undefined)} disabled={isDeleting}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => void removeWarehouse()} disabled={!canManage || isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
}
