import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Menu,
  Paper,
  IconButton,
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
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import {
  createWmsInvitation,
  getWmsInvitations,
  getWmsUsers,
  removeWmsUser,
  resendWmsInvitation,
  revokeWmsInvitation,
  updateWmsUserAccess,
  updateWmsUserRole,
} from '../lib/api';
import type { WmsInvitation, WmsRole, WmsUser } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { useWmsAccess } from '../hooks/useWmsAccess';
import { neon } from '../lib/neon';
import { showToast } from '../lib/toast';

const roles: WmsRole[] = [
  'WarehouseManager',
  'WarehouseOperator',
  'Viewer',
];
const invitationRoles: WmsRole[] = [
  'WarehouseManager',
  'WarehouseOperator',
  'Viewer',
];

function roleLabel(role: WmsRole): string {
  return role.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed.';
}

export function Users() {
  const currentUser = useWmsAccess();
  const session = neon.auth.useSession();
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<Record<string, WmsRole>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailTouched, setInviteEmailTouched] = useState(false);
  const [inviteRole, setInviteRole] = useState<WmsRole>('Viewer');
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuUser, setMenuUser] = useState<WmsUser>();
  const usersQuery = useQuery({
    queryKey: queryKeys.wmsUsers.all,
    queryFn: ({ signal }) => getWmsUsers(signal),
  });
  const invitationsQuery = useQuery({
    queryKey: queryKeys.wmsUsers.invitations,
    queryFn: ({ signal }) => getWmsInvitations(signal),
  });
  useEffect(() => {
    if (usersQuery.isError) {
      showToast(`Could not load WMS users: ${errorMessage(usersQuery.error)}`, 'error');
    }
  }, [usersQuery.error, usersQuery.isError]);
  useEffect(() => {
    if (invitationsQuery.isError) {
      showToast(`Could not load invitations: ${errorMessage(invitationsQuery.error)}`, 'error');
    }
  }, [invitationsQuery.error, invitationsQuery.isError]);
  const mutation = useMutation<
    WmsUser | void,
    Error,
    | { type: 'role'; subject: string; role: WmsRole }
    | { type: 'access'; subject: string; isActive: boolean }
    | { type: 'remove'; subject: string }
  >({
    mutationFn: (change:
      | { type: 'role'; subject: string; role: WmsRole }
      | { type: 'access'; subject: string; isActive: boolean }
      | { type: 'remove'; subject: string }) =>
      change.type === 'role'
        ? updateWmsUserRole(change.subject, change.role)
        : change.type === 'access'
          ? updateWmsUserAccess(change.subject, change.isActive)
          : removeWmsUser(change.subject),
    onSuccess: async (_user, change) => {
      const subject = change.subject;
      const email =
        usersQuery.data?.find((item) => item.subject === subject)?.email ?? subject;
      showToast(
        change.type === 'role'
          ? `Role updated for ${email}.`
          : change.type === 'access'
            ? `WMS access ${change.isActive ? 'activated' : 'deactivated'} for ${email}.`
            : `${email} was removed from WMS.`,
        'success',
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.wmsUsers.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wmsUsers.current }),
      ]);
    },
    onError: (error) => showToast(errorMessage(error), 'error'),
  });
  const inviteMutation = useMutation({
    mutationFn: () => createWmsInvitation(inviteEmail.trim(), inviteRole),
    onSuccess: async (invitation) => {
      setInviteEmail('');
      setInviteEmailTouched(false);
      showToast(`Invitation sent to ${invitation.email}.`, 'success');
    },
    onError: (error) => showToast(errorMessage(error), 'error'),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.wmsUsers.invitations,
      });
    },
  });
  const invitationActionMutation = useMutation({
    mutationFn: (action: { type: 'resend' | 'revoke'; invitation: WmsInvitation }) =>
      action.type === 'resend'
        ? resendWmsInvitation(action.invitation.id)
        : revokeWmsInvitation(action.invitation.id),
    onSuccess: async (invitation, action) => {
      showToast(
        action.type === 'resend'
          ? `Invitation resent to ${invitation.email}.`
          : `Invitation for ${invitation.email} was revoked.`,
        'success',
      );
    },
    onError: (error) => showToast(errorMessage(error), 'error'),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.wmsUsers.invitations,
      });
    },
  });
  const activeEmails = new Set(
    (usersQuery.data ?? [])
      .filter((user) => user.isActive && user.email)
      .map((user) => user.email!.toLowerCase()),
  );
  const visibleInvitations = (invitationsQuery.data ?? []).filter(
    (invitation) =>
      invitation.status !== 'Revoked' &&
      !(
        invitation.status === 'Accepted' &&
        activeEmails.has(invitation.email.toLowerCase())
      ),
  );
  const sortedUsers = [...(usersQuery.data ?? [])].sort(
    (a, b) =>
      Number(b.role === 'Admin') - Number(a.role === 'Admin') ||
      (a.email ?? '').localeCompare(b.email ?? ''),
  );

  const applyRole = (subject: string) => {
    const role = selectedRoles[subject];
    if (
      !role ||
      usersQuery.data?.find((user) => user.subject === subject)?.role === role
    ) {
      return;
    }
    mutation.mutate({ type: 'role', subject, role });
  };

  const toggleAccess = (subject: string, isActive: boolean) => {
    mutation.mutate({ type: 'access', subject, isActive: !isActive });
  };

  const openUserMenu = (
    event: MouseEvent<HTMLElement>,
    user: WmsUser,
  ) => {
    setUserMenuAnchor(event.currentTarget);
    setMenuUser(user);
  };

  const closeUserMenu = () => {
    setUserMenuAnchor(null);
    setMenuUser(undefined);
  };

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, sm: 3 } }}>
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
            Manage warehouse access, roles, and invitations for your team.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Invite a WMS user
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Team members verify their email address before they can access the warehouse.
          </Typography>
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'stretch' } }}
            onSubmit={(event) => {
              event.preventDefault();
              inviteMutation.mutate();
            }}
          >
            <TextField
              size="small"
              required
              type="email"
              label="Email address"
              value={inviteEmail}
              onChange={(event) => {
                setInviteEmail(event.target.value);
              }}
              onBlur={() => setInviteEmailTouched(true)}
              error={inviteEmailTouched && !isValidEmail(inviteEmail.trim())}
              helperText={
                inviteEmailTouched && !isValidEmail(inviteEmail.trim())
                  ? 'Enter a valid email address.'
                  : ' '
              }
              fullWidth
              slotProps={{ htmlInput: { maxLength: 255 } }}
            />
            <FormControl size="small" sx={{ minWidth: { sm: 220 }, alignSelf: 'flex-start' }}>
              <InputLabel id="invite-role-label">WMS role</InputLabel>
              <Select
                labelId="invite-role-label"
                label="WMS role"
                value={inviteRole}
                onChange={(event) => {
                  const role = invitationRoles.find(
                    (item) => item === event.target.value,
                  );
                  if (role) setInviteRole(role);
                }}
              >
                {invitationRoles.map((role) => (
                  <MenuItem key={role} value={role}>
                    {roleLabel(role)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              type="submit"
              size="small"
              variant="contained"
              disabled={!isValidEmail(inviteEmail.trim()) || inviteMutation.isPending}
              sx={{ minWidth: 150, minHeight: 40, alignSelf: { sm: 'flex-start' } }}
            >
              {inviteMutation.isPending ? 'Sending…' : 'Invite user'}
            </Button>
          </Stack>
        </Paper>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
            Invitations
          </Typography>
          <Paper variant="outlined">
            {invitationsQuery.isPending ? (
              <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}>
                <CircularProgress aria-label="Loading invitations" />
              </Box>
            ) : visibleInvitations.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 3 }}>
                No active invitations to display.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Invited</TableCell>
                      <TableCell>Expires</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleInvitations.map((invitation) => {
                      const canManage =
                        invitation.status === 'Pending' ||
                        invitation.status === 'Expired';
                      const isPending =
                        invitationActionMutation.isPending &&
                        invitationActionMutation.variables?.invitation.id === invitation.id;
                      return (
                        <TableRow key={invitation.id} hover>
                          <TableCell sx={{ maxWidth: 280, overflowWrap: 'anywhere' }}>
                            {invitation.email}
                          </TableCell>
                          <TableCell>{roleLabel(invitation.role)}</TableCell>
                          <TableCell>{invitation.status}</TableCell>
                          <TableCell>
                            {new Date(invitation.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {new Date(invitation.expiresAt).toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            <Stack
                              direction={{ xs: 'column', md: 'row' }}
                              spacing={1}
                              sx={{ justifyContent: 'flex-end' }}
                            >
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={!canManage || isPending}
                                onClick={() =>
                                  invitationActionMutation.mutate({
                                    type: 'resend',
                                    invitation,
                                  })
                                }
                              >
                                Resend
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="text"
                                disabled={!canManage || isPending}
                                onClick={() => {
                                  invitationActionMutation.mutate({
                                    type: 'revoke',
                                    invitation,
                                  });
                                }}
                              >
                                Revoke
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

        <Box sx={{ mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            WMS users
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Manage team roles and warehouse access.
          </Typography>
        </Box>

        <Paper variant="outlined">
          {usersQuery.isPending ? (
            <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
              <CircularProgress aria-label="Loading WMS users" />
            </Box>
          ) : usersQuery.isError ? (
            <Stack direction="row" spacing={2} sx={{ p: 3, alignItems: 'center' }}>
              <Typography color="text.secondary">WMS users could not be loaded.</Typography>
              <Button size="small" onClick={() => void usersQuery.refetch()}>
                Retry
              </Button>
            </Stack>
          ) : usersQuery.data?.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 3 }}>
              No WMS users have been discovered yet.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>WMS access</TableCell>
                    <TableCell>First seen</TableCell>
                    <TableCell>Last changed</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedUsers.map((user) => {
                    const isSelf = user.subject === currentUser.subject;
                    const selectedRole = selectedRoles[user.subject] ?? user.role;
                    const isPending =
                      mutation.isPending && mutation.variables?.subject === user.subject;
                    return (
                      <TableRow key={user.subject} hover>
                        <TableCell sx={{ maxWidth: 280, overflowWrap: 'anywhere' }}>
                          {user.email ||
                            (user.subject === currentUser.subject
                              ? session.data?.user.email
                              : undefined) ||
                            'Not provided'}
                          {isSelf && user.role !== 'Admin' && (
                            <Typography component="span" color="text.secondary">
                              {' '}(you)
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.role === 'Admin' ? (
                            <Chip label="Admin" color="primary" size="small" />
                          ) : (
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
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography
                            color={
                              !user.accessProvisionedAt
                                ? 'warning.main'
                                : user.isActive
                                  ? 'success.main'
                                  : 'error.main'
                            }
                          >
                            {!user.accessProvisionedAt
                              ? 'Invitation required'
                              : user.isActive
                                ? 'Active'
                                : 'Inactive'}
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
                            {user.role !== 'Admin' && (
                              <IconButton
                                size="small"
                                aria-label={`Actions for ${user.email ?? user.subject}`}
                                disabled={isPending}
                                onClick={(event) => openUserMenu(event, user)}
                              >
                                <MoreVertOutlinedIcon />
                              </IconButton>
                            )}
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
            <Menu
              anchorEl={userMenuAnchor}
              open={Boolean(userMenuAnchor && menuUser)}
              onClose={closeUserMenu}
            >
              <MenuItem
                disabled={
                  !menuUser ||
                  menuUser.subject === currentUser.subject ||
                  (selectedRoles[menuUser.subject] ?? menuUser.role) === menuUser.role ||
                  mutation.isPending
                }
                onClick={() => {
                  if (menuUser) applyRole(menuUser.subject);
                  closeUserMenu();
                }}
              >
                <SaveOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                Save role
              </MenuItem>
              <MenuItem
                disabled={!menuUser || menuUser.subject === currentUser.subject || mutation.isPending}
                onClick={() => {
                  if (menuUser) toggleAccess(menuUser.subject, menuUser.isActive);
                  closeUserMenu();
                }}
              >
                {menuUser?.isActive ? (
                  <ToggleOffOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                ) : (
                  <ToggleOnOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                )}
                {menuUser?.isActive ? 'Deactivate access' : 'Activate access'}
              </MenuItem>
              <Tooltip
                title={menuUser?.isActive ? 'Deactivate access before removing this user.' : ''}
                placement="left"
              >
                <span>
                  <MenuItem
                    disabled={
                      !menuUser ||
                      menuUser.isActive ||
                      menuUser.subject === currentUser.subject ||
                      mutation.isPending
                    }
                    onClick={() => {
                      if (menuUser) {
                        mutation.mutate({ type: 'remove', subject: menuUser.subject });
                      }
                      closeUserMenu();
                    }}
                  >
                    <DeleteOutlineOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                    Remove user
                  </MenuItem>
                </span>
              </Tooltip>
            </Menu>
      </Box>
    </Box>
  );
}
