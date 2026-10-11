import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export const ThemeModeContext = createContext<{
  mode: ThemeMode;
  toggleMode: () => void;
} | null>(null);

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeModeProvider.');
  }
  return context;
}
