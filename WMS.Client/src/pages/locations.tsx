import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { ToastAlert as Alert } from '../components/ToastProvider';
import { showToast } from '../lib/toast';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { DialogTitleWithClose } from '../components/DialogTitleWithClose';
import { BarcodeLabelButton } from '../components/BarcodeLabelButton';
import {
  ApiError,
  createLocation,
  deleteLocation,
  getLocations,
  getWarehouses,
  updateLocation,
} from '../lib/api';
import type { Location, LocationRequest } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { generateInternalBarcode } from '../lib/barcode';
import { useWmsAccess } from '../hooks/useWmsAccess';
import { isMasterDataManager } from '../lib/wmsPermissions';

interface LocationFormValues {
  warehouseId: string;
  name: string;
  code: string;
  type: string;
  barcode: string;
  isActive: boolean;
}

type FormMode = { type: 'create' } | { type: 'edit'; location: Location };

const emptyForm: LocationFormValues = {
  warehouseId: '',
  name: '',
  code: '',
  type: '',
  barcode: '',
  isActive: true,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function Locations() {
  const canManage = isMasterDataManager(useWmsAccess().role);
  const queryClient = useQueryClient();
  const {
    data: locations = [],
    isPending: isLocationsLoading,
    isError: locationsLoadFailed,
    error: locationsLoadError,
    refetch: refetchLocations,
  } = useQuery({
    queryKey: queryKeys.locations.all,
    queryFn: ({ signal }) => getLocations(signal),
  });
  const {
    data: warehouses = [],
    isPending: isWarehousesLoading,
    isError: warehousesLoadFailed,
    error: warehousesLoadError,
    refetch: refetchWarehouses,
  } = useQuery({
    queryKey: queryKeys.warehouses.all,
    queryFn: ({ signal }) => getWarehouses(signal),
  });
  const isLoading = isLocationsLoading || isWarehousesLoading;
  const loadFailed = locationsLoadFailed || warehousesLoadFailed;
  const loadError = locationsLoadFailed
    ? locationsLoadError
    : warehousesLoadError;
  const retryLoad = () =>
    Promise.all([refetchLocations(), refetchWarehouses()]);
  const [actionError, setActionError] = useState<string>();
  const [formMode, setFormMode] = useState<FormMode>();
  const [formValues, setFormValues] = useState<LocationFormValues>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [deletingLocation, setDeletingLocation] = useState<Location>();
  const invalidateLocationData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryTransactions.all,
      }),
    ]);
  const createMutation = useMutation({
    mutationFn: async (request: LocationRequest) => {
      const location = await createLocation(request);
      if (!location) {
        throw new Error('The API returned no location after creation.');
      }
      return location;
    },
    onSuccess: async () => {
      await invalidateLocationData();
      showToast('Location created successfully.', 'success');
    },
  });
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      request,
    }: {
      id: string;
      request: LocationRequest;
    }) => {
      const location = await updateLocation(id, request);
      if (!location) {
        throw new Error('The API returned no location after the update.');
      }
      return location;
    },
    onSuccess: async () => {
      await invalidateLocationData();
      showToast('Location updated successfully.', 'success');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteLocation,
    onSuccess: async () => {
      await invalidateLocationData();
      showToast('Location deleted successfully.', 'success');
    },
  });
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  const warehouseNames = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [warehouses],
  );

  const openCreateForm = () => {
    setFormValues({ ...emptyForm, warehouseId: warehouses[0]?.id ?? '' });
    setFormErrors({});
    setActionError(undefined);
    setFormMode({ type: 'create' });
  };

  const openEditForm = (location: Location) => {
    setFormValues({
      warehouseId: location.warehouseId,
      name: location.name,
      code: location.code,
      type: location.type,
      barcode: location.barcode ?? '',
      isActive: location.isActive,
    });
    setFormErrors({});
    setActionError(undefined);
    setFormMode({ type: 'edit', location });
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(undefined);
    setFormErrors({});
    const errors: Record<string, string[]> = {};
    const name = formValues.name.trim();
    const code = formValues.code.trim();
    const type = formValues.type.trim();
    const barcode = formValues.barcode.trim();
    if (!formValues.warehouseId) errors.WarehouseId = ['Warehouse is required.'];
    if (!name) errors.Name = ['Name is required.'];
    else if (name.length > 100) errors.Name = ['Name must be 100 characters or fewer.'];
    if (!code) errors.Code = ['Code is required.'];
    else if (code.length > 50) errors.Code = ['Code must be 50 characters or fewer.'];
    if (!type) errors.Type = ['Type is required.'];
    else if (type.length > 50) errors.Type = ['Type must be 50 characters or fewer.'];
    if (barcode.length > 100) errors.Barcode = ['Barcode must be 100 characters or fewer.'];
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const request: LocationRequest = {
      warehouseId: formValues.warehouseId,
      name,
      code,
      type,
      barcode: barcode || null,
      isActive: formValues.isActive,
    };
    try {
      if (formMode?.type === 'edit') {
        await updateMutation.mutateAsync({
          id: formMode.location.id,
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

  const removeLocation = async () => {
    if (!deletingLocation) return;
    setActionError(undefined);
    try {
      await deleteMutation.mutateAsync(deletingLocation.id);
      setDeletingLocation(undefined);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  const fieldError = (field: string) =>
    Object.entries(formErrors).find(
      ([key]) => key.toLowerCase() === field.toLowerCase(),
    )?.[1];
  const isFormValid =
    warehouses.some((warehouse) => warehouse.id === formValues.warehouseId) &&
    formValues.name.trim().length > 0 &&
    formValues.name.trim().length <= 100 &&
    formValues.code.trim().length > 0 &&
    formValues.code.trim().length <= 50 &&
    formValues.type.trim().length > 0 &&
    formValues.type.trim().length <= 50;

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
                    Locations
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Manage storage locations within your warehouses.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreateForm}
                  disabled={!canManage || warehouses.length === 0}
                  sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                >
                  Add location
                </Button>
              </Stack>

              {warehouses.length === 0 && !isLoading && !loadFailed && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Create a warehouse before adding a location.
                </Alert>
              )}
              {actionError && !deletingLocation && (
                <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>
              )}
              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack direction="row" sx={{ p: 2.5, justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      All locations
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {locations.length} {locations.length === 1 ? 'location' : 'locations'}
                    </Typography>
                  </Box>
                </Stack>
                {isLoading ? (
                  <Stack spacing={2} sx={{ py: 8, alignItems: 'center' }} role="status">
                    <CircularProgress size={30} />
                    <Typography color="text.secondary">Loading locations…</Typography>
                  </Stack>
                ) : loadFailed ? (
                  <Stack spacing={2} sx={{ alignItems: 'center', p: 4 }}>
                    <Alert severity="error" sx={{ width: '100%' }}>
                      {errorMessage(loadError)}
                    </Alert>
                    <Button
                      variant="outlined"
                      onClick={() => void retryLoad()}
                    >
                      Retry
                    </Button>
                  </Stack>
                ) : locations.length === 0 ? (
                  <Stack spacing={1.5} sx={{ alignItems: 'center', py: 8, px: 2 }}>
                    <PlaceOutlinedIcon color="action" sx={{ fontSize: 42 }} />
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      No locations yet
                    </Typography>
                    <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                      Add a location to a warehouse to organize inventory storage.
                    </Typography>
                    {warehouses.length > 0 && (
                      <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateForm} disabled={!canManage}>
                        Add your first location
                      </Button>
                    )}
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Location</TableCell>
                          <TableCell>Code</TableCell>
                          <TableCell>Warehouse</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {locations.map((location) => (
                          <TableRow hover key={location.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {location.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {location.barcode || 'No barcode'}
                              </Typography>
                            </TableCell>
                            <TableCell>{location.code}</TableCell>
                            <TableCell>
                              {warehouseNames.get(location.warehouseId) ?? location.warehouseId}
                            </TableCell>
                            <TableCell>{location.type}</TableCell>
                            <TableCell>{location.isActive ? 'Active' : 'Inactive'}</TableCell>
                            <TableCell align="right">
                              <BarcodeLabelButton
                                title={location.name}
                                subtitle={`Location: ${location.code}`}
                                barcode={location.barcode}
                              />
                              <Tooltip title="Edit location">
                                <IconButton
                                  aria-label={`Edit ${location.name}`}
                                  onClick={() => openEditForm(location)}
                                  disabled={!canManage}
                                >
                                  <EditOutlinedIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete location">
                                <IconButton
                                  aria-label={`Delete ${location.name}`}
                                  color="error"
                                  onClick={() => {
                                    setActionError(undefined);
                                    setDeletingLocation(location);
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
              {formMode?.type === 'create' ? 'Add location' : 'Edit location'}
            </DialogTitleWithClose>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {actionError && <Alert severity="error">{actionError}</Alert>}
                <FormControl required error={Boolean(fieldError('WarehouseId'))}>
                  <InputLabel id="location-warehouse-label">Warehouse</InputLabel>
                  <Select
                    labelId="location-warehouse-label"
                    label="Warehouse"
                    value={formValues.warehouseId}
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        warehouseId: event.target.value,
                      }))
                    }
                  >
                    {warehouses.map((warehouse) => (
                      <MenuItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{fieldError('WarehouseId')?.join(' ')}</FormHelperText>
                </FormControl>
                <TextField
                  required
                  label="Location name"
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, name: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 100 } }}
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
                  required
                  label="Type"
                  value={formValues.type}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, type: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 50 } }}
                  error={Boolean(fieldError('Type'))}
                  helperText={fieldError('Type')?.join(' ')}
                />
                <TextField
                  label="Barcode (optional)"
                  value={formValues.barcode}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, barcode: event.target.value }))
                  }
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
                  onClick={() =>
                    setFormValues((current) => ({
                      ...current,
                      barcode: generateInternalBarcode('location'),
                    }))
                  }
                >
                  Generate internal barcode
                </Button>
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
                {isSaving ? 'Saving…' : formMode?.type === 'create' ? 'Create location' : 'Save changes'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
        <Dialog
          open={canManage && Boolean(deletingLocation)}
          onClose={() => !isDeleting && setDeletingLocation(undefined)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitleWithClose
            onClose={() => !isDeleting && setDeletingLocation(undefined)}
            disabled={isDeleting}
          >
            Delete location?
          </DialogTitleWithClose>
          <DialogContent>
            <Typography color="text.secondary">
              Delete {deletingLocation?.name}? Locations referenced by inventory or transactions cannot be deleted.
            </Typography>
            {actionError && <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDeletingLocation(undefined)} disabled={isDeleting}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => void removeLocation()} disabled={!canManage || isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
}
