import { useState } from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import {
  RedirectToSignIn,
  SignedIn,
} from '@neondatabase/neon-js/auth/react/ui';
import { Link as RouterLink, NavLink, Outlet } from 'react-router-dom';
import { neon } from '../lib/neon';
import logoOpen from '../assets/logo-open.png';
import logoClose from '../assets/logo-close.png';

const drawerWidth = 264;
const collapsedDrawerWidth = 76;

const navigation = [
  { label: 'Dashboard', to: '/', icon: <HomeOutlinedIcon /> },
  { label: 'Products', to: '/products', icon: <Inventory2OutlinedIcon /> },
  { label: 'Categories', to: '/categories', icon: <CategoryOutlinedIcon /> },
  { label: 'Warehouses', to: '/warehouses', icon: <WarehouseOutlinedIcon /> },
  { label: 'Locations', to: '/locations', icon: <PlaceOutlinedIcon /> },
  { label: 'Inventory', to: '/inventory', icon: <StorageOutlinedIcon /> },
  {
    label: 'Adjustments',
    to: '/inventory-adjustments',
    icon: <TuneOutlinedIcon />,
  },
  { label: 'Receiving', to: '/receiving', icon: <MoveToInboxOutlinedIcon /> },
  {
    label: 'Transactions',
    to: '/inventory-transactions',
    icon: <HistoryOutlinedIcon />,
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
      .join('') || user?.email?.[0]?.toUpperCase() || 'U';
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
      setSignOutError(
        error instanceof Error ? error.message : 'Could not sign out.',
      );
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
            px: compact || collapsed ? 0 : 1,
            color: 'text.secondary',
            borderRadius: 1,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
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
          Account
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
        {!collapsed && (
          <Box sx={{ flexGrow: 1 }} />
        )}
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
      <List
        sx={{
          px: 1.5,
          py: 0,
          display: 'grid',
          gap: 0.5,
        }}
      >
        {navigation.map((item) => (
          <Tooltip
            key={item.to}
            title={collapsed ? item.label : ''}
            placement="right"
          >
            <ListItemButton
              component={NavLink}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              aria-label={collapsed ? item.label : undefined}
              sx={{
                minHeight: 44,
                justifyContent: 'flex-start',
                px: '6px',
                borderRadius: 1,
                color: 'text.secondary',
                transition: 'background-color 160ms ease, color 160ms ease',
                '& .MuiListItemIcon-root': {
                  color: 'primary.main',
                  minWidth: 38,
                  width: 38,
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
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      {showAccount && (
        <Box sx={{ p: collapsed ? 1 : 1.5 }}>
          <ProfileMenu collapsed={collapsed} onNavigate={onNavigate} />
        </Box>
      )}
    </Box>
  );
}

export function AuthenticatedLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const closeMobileDrawer = () => setMobileOpen(false);

  return (
    <>
      <SignedIn>
        <Box
          sx={{
            display: 'flex',
            minHeight: '100vh',
            bgcolor: 'background.default',
          }}
        >
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              width: sidebarCollapsed ? collapsedDrawerWidth : drawerWidth,
              flexShrink: 0,
              transition: 'width 180ms ease',
              '& .MuiDrawer-paper': {
                width: sidebarCollapsed ? collapsedDrawerWidth : drawerWidth,
                position: 'relative',
                boxSizing: 'border-box',
                borderRight: 1,
                borderColor: 'divider',
                overflowX: 'hidden',
                transition: 'width 180ms ease',
              },
            }}
            open
          >
            <SidebarContents
              collapsed={sidebarCollapsed}
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
                boxSizing: 'border-box',
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
                display: { xs: 'block', md: 'none' },
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Toolbar sx={{ gap: 1 }}>
                <IconButton
                  edge="start"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <MenuIcon />
                </IconButton>
                <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }}>
                  WMS
                </Typography>
                <ProfileMenu compact />
              </Toolbar>
            </AppBar>
            <AuthenticatedOutlet />
          </Box>
        </Box>
      </SignedIn>
      <RedirectToSignIn />
    </>
  );
}
