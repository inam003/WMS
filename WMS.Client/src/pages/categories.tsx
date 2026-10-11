import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
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
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { DialogTitleWithClose } from '../components/DialogTitleWithClose';
import {
  ApiError,
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '../lib/api';
import type { Category, CategoryRequest } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { useWmsAccess } from '../hooks/useWmsAccess';
import { isMasterDataManager } from '../lib/wmsPermissions';

interface CategoryFormValues {
  name: string;
  description: string;
}

type FormMode = { type: 'create' } | { type: 'edit'; category: Category };

const emptyForm: CategoryFormValues = { name: '', description: '' };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function Categories() {
  const canManage = isMasterDataManager(useWmsAccess().role);
  const queryClient = useQueryClient();
  const {
    data: categories = [],
    isPending: isLoading,
    isError,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: ({ signal }) => getCategories(signal),
  });
  const [actionError, setActionError] = useState<string>();
  const [formMode, setFormMode] = useState<FormMode>();
  const [formValues, setFormValues] = useState<CategoryFormValues>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [deletingCategory, setDeletingCategory] = useState<Category>();
  const createMutation = useMutation({
    mutationFn: async (request: CategoryRequest) => {
      const category = await createCategory(request);
      if (!category) {
        throw new Error('The API returned no category after creation.');
      }
      return category;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      request,
    }: {
      id: string;
      request: CategoryRequest;
    }) => {
      const category = await updateCategory(id, request);
      if (!category) {
        throw new Error('The API returned no category after the update.');
      }
      return category;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
  });
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  const openCreateForm = () => {
    setFormValues(emptyForm);
    setFormErrors({});
    setActionError(undefined);
    setFormMode({ type: 'create' });
  };

  const openEditForm = (category: Category) => {
    setFormValues({
      name: category.name,
      description: category.description ?? '',
    });
    setFormErrors({});
    setActionError(undefined);
    setFormMode({ type: 'edit', category });
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(undefined);
    setFormErrors({});

    const name = formValues.name.trim();
    const description = formValues.description.trim();
    const errors: Record<string, string[]> = {};
    if (!name) {
      errors.Name = ['Name is required.'];
    } else if (name.length > 100) {
      errors.Name = ['Name must be 100 characters or fewer.'];
    }
    if (description.length > 500) {
      errors.Description = ['Description must be 500 characters or fewer.'];
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const request: CategoryRequest = {
      name,
      description: description || null,
    };

    try {
      if (formMode?.type === 'edit') {
        await updateMutation.mutateAsync({
          id: formMode.category.id,
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

  const removeCategory = async () => {
    if (!deletingCategory) {
      return;
    }

    setActionError(undefined);
    try {
      await deleteMutation.mutateAsync(deletingCategory.id);
      setDeletingCategory(undefined);
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
    formValues.name.trim().length <= 100 &&
    formValues.description.trim().length <= 500;

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
                  <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                    Categories
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Organize products into reusable catalog categories.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreateForm}
                  disabled={!canManage}
                  sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                >
                  Add category
                </Button>
              </Stack>

              {actionError && !deletingCategory && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {actionError}
                </Alert>
              )}

              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{
                    p: 2.5,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      All categories
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {categories.length}{' '}
                      {categories.length === 1 ? 'category' : 'categories'}
                    </Typography>
                  </Box>
                </Stack>

                {isLoading ? (
                  <Stack
                    spacing={2}
                    sx={{ py: 8, alignItems: 'center', justifyContent: 'center' }}
                    role="status"
                  >
                    <CircularProgress size={30} />
                    <Typography color="text.secondary">
                      Loading categories…
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
                ) : categories.length === 0 ? (
                  <Stack spacing={1.5} sx={{ alignItems: 'center', py: 8, px: 2 }}>
                    <CategoryOutlinedIcon color="action" sx={{ fontSize: 42 }} />
                    <Typography variant="h6" sx={{ fontWeight: 650 }}>
                      No categories yet
                    </Typography>
                    <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                      Create a category before adding products to the catalog.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={openCreateForm}
                      disabled={!canManage}
                    >
                      Add your first category
                    </Button>
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {categories.map((category) => (
                          <TableRow hover key={category.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 650 }}>
                                {category.name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {category.description || (
                                <Typography variant="body2" color="text.secondary">
                                  No description
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Edit category">
                                <IconButton
                                  aria-label={`Edit ${category.name}`}
                                  onClick={() => openEditForm(category)}
                                  disabled={!canManage}
                                >
                                  <EditOutlinedIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete category">
                                <IconButton
                                  aria-label={`Delete ${category.name}`}
                                  color="error"
                                  onClick={() => {
                                    setActionError(undefined);
                                    setDeletingCategory(category);
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
              {formMode?.type === 'create' ? 'Add category' : 'Edit category'}
            </DialogTitleWithClose>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {actionError && <Alert severity="error">{actionError}</Alert>}
                <TextField
                  required
                  fullWidth
                  label="Category name"
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  error={Boolean(fieldError('Name'))}
                  helperText={fieldError('Name')?.join(' ')}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Description"
                  value={formValues.description}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                  error={Boolean(fieldError('Description'))}
                  helperText={fieldError('Description')?.join(' ')}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setFormMode(undefined)} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={!canManage || isSaving || !isFormValid}
                startIcon={
                  isSaving ? <CircularProgress size={16} color="inherit" /> : null
                }
              >
                {isSaving
                  ? 'Saving…'
                  : formMode?.type === 'create'
                    ? 'Create category'
                    : 'Save changes'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>

        <Dialog
          open={canManage && Boolean(deletingCategory)}
          onClose={() => !isDeleting && setDeletingCategory(undefined)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitleWithClose
            onClose={() => !isDeleting && setDeletingCategory(undefined)}
            disabled={!canManage || isDeleting}
          >
            Delete category?
          </DialogTitleWithClose>
          <DialogContent>
            <Typography color="text.secondary">
              Delete {deletingCategory?.name}? This cannot be undone. Categories
              referenced by products cannot be deleted.
            </Typography>
            {actionError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {actionError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={() => setDeletingCategory(undefined)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => void removeCategory()}
              disabled={!canManage || isDeleting}
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
