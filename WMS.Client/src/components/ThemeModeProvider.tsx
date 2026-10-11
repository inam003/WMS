import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ThemeModeContext, type ThemeMode } from '../lib/themeMode';
const storageKey = 'wms-color-mode';

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() =>
    window.localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.style.colorScheme = mode;
    window.localStorage.setItem(storageKey, mode);
  }, [mode]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#2563eb',
            light: '#3b82f6',
            dark: '#3b82f6',
          },
          background:
            mode === 'light'
              ? { default: '#f5f7fb', paper: '#ffffff' }
              : { default: '#111827', paper: '#1f2937' },
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
      }),
    [mode],
  );

  return (
    <ThemeModeContext.Provider
      value={{
        mode,
        toggleMode: () =>
          setMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light')),
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
