import { useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AppBar,
  alpha,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Toolbar,
  Typography,
} from '@mui/material';
import { ToastAlert as Alert } from './ToastProvider';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { RedirectToSignIn, SignedIn } from '@neondatabase/neon-js/auth/react/ui';
import { Link as RouterLink, NavLink, Outlet, useLocation } from 'react-router-dom';
import { neon } from '../lib/neon';
import { ApiError, getCurrentWmsUser } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { WmsAccessProvider } from './WmsAccessContext';
import { useWmsAccess } from '../hooks/useWmsAccess';
import logoOpen from '../assets/logo-open.png';
import logoClose from '../assets/logo-close.png';

const drawerWidth = 264;
const collapsedDrawerWidth = 76;

interface NavItem {
  label: string;
  to: string;
  icon: ReactElement;
}

const navigationGroups: { label: string; icon: ReactElement; items: NavItem[] }[] = [
  {
    label: 'Overview',
    icon: <DashboardOutlinedIcon />,
    items: [
      { label: 'Dashboard', to: '/', icon: <HomeOutlinedIcon /> },
      { label: 'Reports', to: '/reports', icon: <AssessmentOutlinedIcon /> },
    ],
  },
  {
    label: 'Catalog',
    icon: <Inventory2OutlinedIcon />,
    items: [
      { label: 'Products', to: '/products', icon: <Inventory2OutlinedIcon /> },
      { label: 'Categories', to: '/categories', icon: <CategoryOutlinedIcon /> },
    ],
  },
  {
    label: 'Warehouse',
    icon: <WarehouseOutlinedIcon />,
    items: [
      { label: 'Warehouses', to: '/warehouses', icon: <WarehouseOutlinedIcon /> },
      { label: 'Locations', to: '/locations', icon: <PlaceOutlinedIcon /> },
    ],
  },
  {
    label: 'Stock',
    icon: <StorageOutlinedIcon />,
    items: [
      { label: 'Inventory', to: '/inventory', icon: <StorageOutlinedIcon /> },
      { label: 'Receiving', to: '/receiving', icon: <MoveToInboxOutlinedIcon /> },
      { label: 'Adjustments', to: '/inventory-adjustments', icon: <TuneOutlinedIcon /> },
      { label: 'Transfers', to: '/warehouse-transfers', icon: <SwapHorizOutlinedIcon /> },
      { label: 'Transactions', to: '/inventory-transactions', icon: <HistoryOutlinedIcon /> },
    ],
  },
  {
    label: 'Sales',
    icon: <ShoppingCartOutlinedIcon />,
    items: [{ label: 'Orders', to: '/orders', icon: <ShoppingCartOutlinedIcon /> }],
  },
  {
    label: 'Administration',
    icon: <ManageAccountsOutlinedIcon />,
    items: [{ label: 'Users', to: '/users', icon: <ManageAccountsOutlinedIcon /> }],
  },
];

function AuthenticatedOutlet() {
  const session = neon.auth.useSession();
  if (session.isPending || !session.data?.user) {
    return null;
  }

  return <Outlet />;
}

function ProfileMenu({
  collapsed = false,
  compact = false,
  onNavigate,
}: {
  collapsed?: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const session = neon.auth.useSession();
  const user = session.data?.user;
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [signOutError, setSignOutError] = useState<string>();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = user?.name || user?.email || 'Account';
  const initials =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') ||
    user?.email?.[0]?.toUpperCase() ||
    'U';
  const closeProfileMenu = () => {
    setProfileAnchor(null);
    onNavigate?.();
  };
  const signOut = async () => {
    setIsSigningOut(true);
    setSignOutError(undefined);
    try {
      const result = await neon.auth.signOut();
      if (result.error) {
        setSignOutError(result.error.message || 'Could not sign out.');
        return;
      }
      closeProfileMenu();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <Tooltip title={collapsed ? displayName : ''} placement="right">
        <Button
          fullWidth={!compact}
          onClick={(event) => {
            setSignOutError(undefined);
            setProfileAnchor(event.currentTarget);
          }}
          aria-haspopup="menu"
          aria-expanded={Boolean(profileAnchor)}
          aria-label={`Open account menu for ${displayName}`}
          sx={{
            minHeight: compact ? 44 : 48,
            minWidth: compact ? 44 : undefined,
            justifyContent: compact || collapsed ? 'center' : 'flex-start',
            gap: 1.25,
            px: compact ? 1 : collapsed ? 0 : 1,
            color: 'text.secondary',
            borderRadius: 1,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {compact && (
            <Typography
              variant="body2"
              noWrap
              sx={{
                display: { xs: 'none', sm: 'block' },
                maxWidth: 220,
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              {displayName}
            </Typography>
          )}
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: 'primary.main',
              color: 'common.white',
              fontSize: 13,
            }}
          >
            {initials}
          </Avatar>
          {!compact && !collapsed && (
            <Typography
              variant="body2"
              noWrap
              sx={{ flexGrow: 1, textAlign: 'left', fontWeight: 600 }}
            >
              {displayName}
            </Typography>
          )}
        </Button>
      </Tooltip>
      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={closeProfileMenu}
        anchorOrigin={{ vertical: compact ? 'bottom' : 'top', horizontal: 'right' }}
        transformOrigin={{
          vertical: compact ? 'top' : 'bottom',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              minWidth: 248,
              p: 1,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.paper',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
              '& .MuiList-root': { p: 0 },
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: 'primary.main',
              color: 'common.white',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
              {displayName}
            </Typography>
            {user?.email && user.name && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {user.email}
              </Typography>
            )}
          </Box>
        </Box>
        <Divider sx={{ my: 0.75 }} />
        <MenuItem
          component={RouterLink}
          to="/account"
          onClick={closeProfileMenu}
          sx={{
            minHeight: 42,
            gap: 1,
            borderRadius: 1,
            '& .MuiListItemIcon-root': {
              minWidth: 32,
              color: 'primary.main',
            },
          }}
        >
          <ListItemIcon>
            <AccountCircleOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem
          onClick={() => void signOut()}
          disabled={isSigningOut}
          sx={{
            minHeight: 42,
            gap: 1,
            borderRadius: 1,
            color: 'error.main',
            '& .MuiListItemIcon-root': {
              minWidth: 32,
              color: 'error.main',
            },
            '&:hover, &:focus-visible': {
              bgcolor: 'error.main',
              color: 'common.white',
              '& .MuiListItemIcon-root': { color: 'common.white' },
            },
          }}
        >
          <ListItemIcon>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </MenuItem>
        {signOutError && (
          <Box sx={{ px: 1.5, pb: 1.5, maxWidth: 280 }}>
            <Alert severity="error">{signOutError}</Alert>
          </Box>
        )}
      </Menu>
    </>
  );
}

function SidebarContents({
  onNavigate,
  collapsed = false,
  onToggle,
  showAccount = true,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
  showAccount?: boolean;
}) {
  const wmsUser = useWmsAccess();
  const [openGroups, setOpenGroups] = useState<string[]>([navigationGroups[0].label]);
  const location = useLocation();
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.to === '/users') {
          return wmsUser.role === 'Admin';
        }
        if (['/receiving', '/inventory-adjustments', '/warehouse-transfers'].includes(item.to)) {
          return wmsUser.role !== 'Viewer';
        }
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
  const toggleGroup = (label: string) =>
    setOpenGroups((current) =>
      current.includes(label) ? current.filter((l) => l !== label) : [...current, label],
    );

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <Toolbar
        sx={{
          minHeight: '72px !important',
          px: '6px',
          gap: 1,
          justifyContent: 'flex-start',
          flexShrink: 0,
        }}
      >
        {collapsed && onToggle ? (
          <IconButton
            onClick={onToggle}
            aria-label="Expand sidebar"
            sx={{
              position: 'relative',
              width: 44,
              height: 44,
              minWidth: 44,
              p: 0,
              flexShrink: 0,
              color: 'primary.main',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                m: 'auto',
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: 'action.hover',
                opacity: 0,
                transform: 'translateX(-6px)',
                transition: 'opacity 120ms ease',
              },
              '&:hover': { bgcolor: 'transparent' },
              '&:hover::before, &:focus-visible::before': { opacity: 1 },
              '&:hover img': { opacity: 0 },
              '& svg': {
                position: 'absolute',
                inset: 0,
                m: 'auto',
                opacity: 0,
                transition: 'opacity 120ms ease, transform 120ms ease',
              },
              '&:hover svg, &:focus-visible svg': {
                opacity: 1,
                transform: 'translateX(-6px)',
              },
            }}
          >
            <Box
              component="img"
              src={logoClose}
              alt="Expand sidebar"
              sx={{
                width: 44,
                height: 44,
                ml: '-18px',
                objectFit: 'contain',
                transition: 'opacity 120ms ease',
              }}
            />
            <ChevronRightIcon />
          </IconButton>
        ) : (
          <Box
            component="img"
            src={logoOpen}
            alt="WMS"
            sx={{
              width: 180,
              height: 64,
              ml: '-14px',
              objectFit: 'contain',
              objectPosition: 'left center',
              flexShrink: 0,
            }}
          />
        )}
        {!collapsed && <Box sx={{ flexGrow: 1 }} />}
        {onToggle && !collapsed && (
          <IconButton
            size="small"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            sx={{ ml: 'auto' }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Toolbar>
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          px: 1.5,
          py: 0.5,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        }}
      >
        <List
          sx={{
            p: 0,
            display: 'grid',
            gap: 0.5,
            alignContent: 'start',
          }}
        >
          {visibleGroups.map((group, index) => {
            const isOpen =
              openGroups.includes(group.label) ||
              group.items.some((item) =>
                item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
              );
            const renderItem = (item: NavItem) => (
              <Tooltip key={item.to} title={collapsed ? item.label : ''} placement="right">
                <ListItemButton
                  component={NavLink}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  aria-label={collapsed ? item.label : undefined}
                  sx={{
                    width: collapsed ? 48 : '100%',
                    maxWidth: collapsed ? 48 : 'none',
                    minWidth: 0,
                    minHeight: collapsed ? 48 : 44,
                    mx: 'auto',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 0 : '6px',
                    borderRadius: 1,
                    color: 'text.secondary',
                    transition: 'background-color 160ms ease, color 160ms ease',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                      minWidth: collapsed ? 0 : 38,
                      width: collapsed ? 'auto' : 38,
                      flexShrink: 0,
                      justifyContent: 'center',
                      '& .MuiSvgIcon-root': { fontSize: 24 },
                    },
                    '&:hover': {
                      bgcolor: 'action.hover',
                      color: 'text.primary',
                    },
                    '&.active': {
                      color: 'common.white',
                      bgcolor: 'primary.main',
                      fontWeight: 700,
                      '& .MuiListItemIcon-root': { color: 'common.white' },
                      '&:hover': { bgcolor: 'primary.light' },
                    },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: { variant: 'body2', sx: { fontWeight: 600 } },
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            );
            if (collapsed) {
              return (
                <Box key={group.label} sx={{ display: 'grid', gap: 0.5 }}>
                  {index > 0 && <Divider sx={{ my: 0.5 }} />}
                  {group.items.map(renderItem)}
                </Box>
              );
            }
            return (
              <Box key={group.label}>
                <ListItemButton
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                  sx={{
                    borderRadius: 1.5,
                    px: 1,
                    py: 0.75,
                    gap: 1.25,
                    color: isOpen ? 'text.primary' : 'text.secondary',
                    '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1.5,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      color: 'primary.main',
                      bgcolor: (theme) => alpha(theme.palette.primary.main, isOpen ? 0.14 : 0.08),
                      '& .MuiSvgIcon-root': { fontSize: 20 },
                    }}
                  >
                    {group.icon}
                  </Box>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>
                    {group.label}
                  </Typography>
                  <ExpandMoreIcon
                    fontSize="small"
                    sx={{
                      color: 'text.disabled',
                      transition: 'transform 160ms',
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                    }}
                  />
                </ListItemButton>
                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 0.25,
                      my: 0.5,
                      ml: 2.5,
                      pl: 1,
                      borderLeft: 1,
                      borderColor: 'divider',
                    }}
                  >
                    {group.items.map(renderItem)}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>
      {showAccount && (
        <Box
          sx={{
            p: collapsed ? 1 : 1.5,
            flexShrink: 0,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <ProfileMenu collapsed={collapsed} onNavigate={onNavigate} />
        </Box>
      )}
    </Box>
  );
}

function AuthenticatedShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { role } = useWmsAccess();
  const closeMobileDrawer = () => setMobileOpen(false);

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: sidebarCollapsed ? collapsedDrawerWidth : drawerWidth,
          flexShrink: 0,
          height: '100vh',
          transition: 'width 180ms ease',
          '& .MuiDrawer-paper': {
            width: sidebarCollapsed ? collapsedDrawerWidth : drawerWidth,
            height: '100vh',
            maxHeight: '100vh',
            position: 'sticky',
            top: 0,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
            backgroundImage: 'none',
            bgcolor: 'background.paper',
            overflow: 'hidden',
            transition: 'width 180ms ease',
          },
        }}
        open
      >
        <SidebarContents
          collapsed={sidebarCollapsed}
          showAccount={false}
          onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        />
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={closeMobileDrawer}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            height: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
          },
        }}
      >
        <SidebarContents onNavigate={closeMobileDrawer} showAccount={false} />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar
            sx={{
              gap: 1,
              minHeight: '72px !important',
              px: { xs: 1, md: 3 },
            }}
          >
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ display: { xs: 'block', md: 'none' }, fontWeight: 800 }}>
              WMS
            </Typography>
            <Typography
              variant="subtitle1"
              sx={{ display: { xs: 'none', md: 'block' }, fontWeight: 700 }}
            >
              {role.replace(/([a-z])([A-Z])/g, '$1 $2')}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <ProfileMenu compact />
          </Toolbar>
        </AppBar>
        <AuthenticatedOutlet />
      </Box>
    </Box>
  );
}

function WmsAccessGate() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const userQuery = useQuery({
    queryKey: queryKeys.wmsUsers.current,
    queryFn: getCurrentWmsUser,
    retry: false,
  });

  if (userQuery.isPending) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress aria-label="Checking WMS access" />
      </Box>
    );
  }

  if (userQuery.isError || !userQuery.data?.isActive) {
    const status =
      typeof userQuery.error === 'object' && userQuery.error !== null && 'status' in userQuery.error
        ? userQuery.error.status
        : undefined;
    const message =
      userQuery.error instanceof ApiError && userQuery.error.code === 'WMS_INVITATION_REQUIRED'
        ? 'Your account is signed in, but it has not been given access to this warehouse yet.'
        : userQuery.error instanceof ApiError && userQuery.error.code === 'WMS_ACCESS_INACTIVE'
          ? 'Your warehouse access has been turned off. Contact your warehouse administrator if you think this is a mistake.'
          : status === 401
            ? 'Your sign-in has expired. Sign in again to continue.'
            : status === 403 || !userQuery.data?.isActive
              ? 'Your warehouse access is unavailable. Contact your warehouse administrator.'
              : userQuery.error instanceof Error
                ? userQuery.error.message
                : 'We could not check your warehouse access right now.';
    const needsInvitation =
      userQuery.error instanceof ApiError && userQuery.error.code === 'WMS_INVITATION_REQUIRED';
    const signOut = async () => {
      setIsSigningOut(true);
      setSignOutError(undefined);
      try {
        const result = await neon.auth.signOut();
        if (result.error) {
          setSignOutError(result.error.message || 'Could not sign out.');
        }
      } catch (error) {
        setSignOutError(error instanceof Error ? error.message : 'Could not sign out.');
      } finally {
        setIsSigningOut(false);
      }
    };
    return (
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'background.default',
          px: { xs: 2, sm: 3 },
          py: { xs: 3, md: 5 },
        }}
      >
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: 560, p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Box
              sx={{
                width: 56,
                height: 56,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                color: needsInvitation ? 'error.main' : 'primary.main',
                bgcolor: needsInvitation ? 'rgba(211, 47, 47, 0.12)' : 'action.hover',
              }}
            >
              {needsInvitation ? (
                <BlockOutlinedIcon sx={{ fontSize: 42 }} />
              ) : (
                <ShieldOutlinedIcon fontSize="large" />
              )}
            </Box>
            <Box>
              <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
                WAREHOUSE MANAGEMENT
              </Typography>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                {needsInvitation ? 'Access not set up yet' : 'We can’t open your workspace'}
              </Typography>
            </Box>
            <Alert severity={needsInvitation ? 'info' : 'error'}>
              {message}
              {needsInvitation && (
                <>
                  {' '}
                  If you have an invitation, create an account with the same email address and
                  complete email verification. Contact your WMS Admin if you still cannot access the
                  workspace.
                </>
              )}
            </Alert>
            {signOutError && <Alert severity="error">{signOutError}</Alert>}
            <Button variant="outlined" onClick={() => void signOut()} disabled={isSigningOut}>
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <WmsAccessProvider user={userQuery.data}>
      <AuthenticatedShell />
    </WmsAccessProvider>
  );
}

export function AuthenticatedLayout() {
  return (
    <>
      <SignedIn>
        <WmsAccessGate />
      </SignedIn>
      <RedirectToSignIn />
    </>
  );
}
