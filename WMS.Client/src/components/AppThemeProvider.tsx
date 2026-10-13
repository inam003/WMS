import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
        palette: {
          primary: {
            main: '#2563eb',
            light: '#3b82f6',
            dark: '#3b82f6',
          },
          background:
            { default: '#f5f7fb', paper: '#ffffff' },
        },
        shape: { borderRadius: 10 },
        typography: {
          fontFamily: 'Roboto, Arial, sans-serif',
          button: { textTransform: 'none', fontWeight: 600 },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                '&&.MuiButton-containedPrimary:hover': {
                  '--variant-containedBg': '#3b82f6',
                },
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                '& > form': {
                  display: 'flex',
                  flex: '1 1 auto',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                },
              },
            },
          },
          MuiDialogContent: {
            styleOverrides: {
              root: {
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'scroll',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                '&::-webkit-scrollbar': {
                  width: 0,
                  height: 0,
                },
              },
            },
          },
        },
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
