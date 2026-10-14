import { useState } from 'react';
import { AccountView } from '@neondatabase/neon-js/auth/react/ui';
import {
  Box,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { AuditHistory } from './audit-history';
import { useWmsAccess } from '../hooks/useWmsAccess';

type AccountTab = 'account' | 'security' | 'audit';

export function Account() {
  const { pathname } = useParams();
  const isAdmin = useWmsAccess().role === 'Admin';
  const [activeTab, setActiveTab] = useState<AccountTab>(() =>
    pathname === 'security'
      ? 'security'
      : pathname === 'audit-history' && isAdmin
        ? 'audit'
        : 'account',
  );

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, sm: 3 } }}>
        <Stack spacing={0.5} sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 700, letterSpacing: 1.2 }}
          >
            PROFILE
          </Typography>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Account settings
          </Typography>
          <Typography color="text.secondary">
            Manage your profile and security{isAdmin ? ', and review audit history' : ''}.
          </Typography>
        </Stack>

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(_event, value: AccountTab) => setActiveTab(value)}
            variant="scrollable"
            allowScrollButtonsMobile
            aria-label="Account settings sections"
            sx={{
              px: { xs: 1, sm: 2 },
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': { minHeight: 60, textTransform: 'none' },
              '& .Mui-selected': { color: 'primary.main' },
            }}
          >
            <Tab value="account" label="Account" />
            <Tab value="security" label="Security" />
            {isAdmin && <Tab value="audit" label="Audit history" />}
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {activeTab === 'audit' && isAdmin ? (
              <AuditHistory embedded />
            ) : (
            <Box
                sx={(theme) => ({
                  '--background': theme.palette.background.default,
                  '--foreground': theme.palette.text.primary,
                  '--card': theme.palette.background.paper,
                  '--card-foreground': theme.palette.text.primary,
                  '--popover': theme.palette.background.paper,
                  '--popover-foreground': theme.palette.text.primary,
                  '--primary': theme.palette.primary.main,
                  '--primary-foreground': theme.palette.primary.contrastText,
                  '--secondary': theme.palette.action.hover,
                  '--secondary-foreground': theme.palette.text.primary,
                  '--muted': theme.palette.action.hover,
                  '--muted-foreground': theme.palette.text.secondary,
                  '--accent': theme.palette.action.hover,
                  '--accent-foreground': theme.palette.text.primary,
                  '--border': theme.palette.divider,
                  '--input': theme.palette.divider,
                  '--ring': theme.palette.primary.main,
                  '--sidebar': theme.palette.background.paper,
                  '--sidebar-foreground': theme.palette.text.primary,
                  '--sidebar-primary': theme.palette.primary.main,
                  '--sidebar-primary-foreground':
                    theme.palette.primary.contrastText,
                  '--sidebar-accent': theme.palette.action.hover,
                  '--sidebar-accent-foreground': theme.palette.text.primary,
                  '--sidebar-border': theme.palette.divider,
                  '--sidebar-ring': theme.palette.primary.main,
                  '--color-background': theme.palette.background.default,
                  '--color-foreground': theme.palette.text.primary,
                  '--color-card': theme.palette.background.paper,
                  '--color-card-foreground': theme.palette.text.primary,
                  '--color-popover': theme.palette.background.paper,
                  '--color-popover-foreground': theme.palette.text.primary,
                  '--color-primary': theme.palette.primary.main,
                  '--color-primary-foreground':
                    theme.palette.primary.contrastText,
                  '--color-secondary': theme.palette.action.hover,
                  '--color-secondary-foreground': theme.palette.text.primary,
                  '--color-muted': theme.palette.action.hover,
                  '--color-muted-foreground': theme.palette.text.secondary,
                  '--color-accent': theme.palette.action.hover,
                  '--color-accent-foreground': theme.palette.text.primary,
                  '--color-border': theme.palette.divider,
                  '--color-input': theme.palette.divider,
                  '--color-ring': theme.palette.primary.main,
                  '--color-sidebar': theme.palette.background.paper,
                  '--color-sidebar-foreground': theme.palette.text.primary,
                  '--color-sidebar-primary': theme.palette.primary.main,
                  '--color-sidebar-primary-foreground':
                    theme.palette.primary.contrastText,
                  '--color-sidebar-accent': theme.palette.action.hover,
                  '--color-sidebar-accent-foreground':
                    theme.palette.text.primary,
                  '--color-sidebar-border': theme.palette.divider,
                  '--color-sidebar-ring': theme.palette.primary.main,
                  color: 'text.primary',
                  '& [data-slot="card"]': {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderColor: 'divider',
                  },
                  '& [data-slot="card"] input, & [data-slot="card"] textarea': {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                  },
                })}
              >
                <AccountView
                  view={activeTab === 'security' ? 'SECURITY' : 'SETTINGS'}
                  hideNav
                  classNames={{
                    base: 'w-full',
                    cards: 'w-full gap-4',
                    card: {
                      base: 'w-full rounded-xl shadow-sm',
                      header: 'gap-2',
                    },
                  }}
                />
            </Box>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
