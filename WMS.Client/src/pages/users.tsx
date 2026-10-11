import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
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
  Typography,
} from '@mui/material';
import {
  getWmsUsers,
  updateWmsUserAccess,
  updateWmsUserRole,
} from '../lib/api';
import type { WmsRole } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { useWmsAccess } from '../hooks/useWmsAccess';

const roles: WmsRole[] = [
  'Admin',
  'WarehouseManager',
  'WarehouseOperator',
  'Viewer',
];

function roleLabel(role: WmsRole): string {
  return role.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function Users() {
  const currentUser = useWmsAccess();
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<Record<string, WmsRole>>({});
  const [success, setSuccess] = useState<string>();
  const usersQuery = useQuery({
    queryKey: queryKeys.wmsUsers.all,
    queryFn: ({ signal }) => getWmsUsers(signal),
  });
  const mutation = useMutation({
    mutationFn: (change:
      | { type: 'role'; subject: string; role: WmsRole }
      | { type: 'access'; subject: string; isActive: boolean }) =>
      change.type === 'role'
        ? updateWmsUserRole(change.subject, change.role)
        : updateWmsUserAccess(change.subject, change.isActive),
    onSuccess: async (user, change) => {
      setSuccess(
        change.type === 'role'
          ? `Role updated for ${user.subject}.`
          : `WMS access ${user.isActive ? 'activated' : 'deactivated'} for ${user.subject}.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.wmsUsers.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wmsUsers.current }),
      ]);
    },
  });

  const applyRole = (subject: string) => {
    const role = selectedRoles[subject];
    if (
      !role ||
      usersQuery.data?.find((user) => user.subject === subject)?.role === role
    ) {
      return;
    }
    if (
      !window.confirm(
        `Change this user's WMS role to ${roleLabel(role)}?`,
      )
    ) {
      return;
    }
    setSuccess(undefined);
    mutation.mutate({ type: 'role', subject, role });
  };

  const toggleAccess = (subject: string, isActive: boolean) => {
    const action = isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} WMS access for this user?`)) {
      return;
    }
    setSuccess(undefined);
    mutation.mutate({ type: 'access', subject, isActive: !isActive });
  };

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3 } }}>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 700, letterSpacing: 1.2 }}
          >
            ADMINISTRATION
          </Typography>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Users & access
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Manage WMS roles and access independently of Neon Auth accounts.
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Users appear after they first sign in and access WMS. Neon Auth user-directory
          management is not available through the configured integration; identities
          remain managed by Neon Auth.
        </Alert>
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(undefined)}>
            {success}
          </Alert>
        )}
        {mutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => mutation.reset()}>
            {errorMessage(mutation.error)}
          </Alert>
        )}
        {usersQuery.isError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => void usersQuery.refetch()}
              >
                Retry
              </Button>
            }
          >
            Could not load WMS users: {errorMessage(usersQuery.error)}
          </Alert>
        )}

        <Paper variant="outlined">
          {usersQuery.isPending ? (
            <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
              <CircularProgress aria-label="Loading WMS users" />
            </Box>
          ) : usersQuery.data?.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 3 }}>
              No WMS users have been discovered yet.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Neon subject</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>WMS access</TableCell>
                    <TableCell>First seen</TableCell>
                    <TableCell>Last changed</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(usersQuery.data ?? []).map((user) => {
                    const isSelf = user.subject === currentUser.subject;
                    const selectedRole = selectedRoles[user.subject] ?? user.role;
                    const isPending =
                      mutation.isPending && mutation.variables?.subject === user.subject;
                    return (
                      <TableRow key={user.subject} hover>
                        <TableCell sx={{ maxWidth: 280, overflowWrap: 'anywhere' }}>
                          {user.subject}
                          {isSelf && (
                            <Typography component="span" color="text.secondary">
                              {' '}(you)
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 190 }}>
                            <InputLabel id={`role-label-${user.subject}`}>Role</InputLabel>
                            <Select
                              labelId={`role-label-${user.subject}`}
                              label="Role"
                              value={selectedRole}
                              disabled={isSelf || isPending}
                              onChange={(event) =>
                                setSelectedRoles((current) => {
                                  const role = roles.find(
                                    (item) => item === event.target.value,
                                  );
                                  return role
                                    ? { ...current, [user.subject]: role }
                                    : current;
                                })
                              }
                            >
                              {roles.map((role) => (
                                <MenuItem key={role} value={role}>
                                  {roleLabel(role)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <Typography color={user.isActive ? 'success.main' : 'error.main'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Typography>
                        </TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{new Date(user.updatedAt).toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1}
                            sx={{ justifyContent: 'flex-end' }}
                          >
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={
                                isSelf ||
                                isPending ||
                                selectedRole === user.role
                              }
                              onClick={() => applyRole(user.subject)}
                            >
                              Save role
                            </Button>
                            <Button
                              size="small"
                              color={user.isActive ? 'error' : 'primary'}
                              variant={user.isActive ? 'text' : 'outlined'}
                              disabled={isSelf || isPending}
                              onClick={() => toggleAccess(user.subject, user.isActive)}
                            >
                              {user.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
