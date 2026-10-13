import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react';
import '@neondatabase/neon-js/ui/css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthQueryCacheLifecycle } from './components/AuthQueryCacheLifecycle';
import { ToastProvider } from './components/ToastProvider';
import { AppThemeProvider } from './components/AppThemeProvider';
import { neon } from './lib/neon';
import { queryClient } from './lib/queryClient';
import favicon from './assets/logo-close.png';
import './index.css';

const faviconLink = document.querySelector<HTMLLinkElement>('#app-favicon');
if (faviconLink) faviconLink.href = favicon;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NeonAuthUIProvider emailOTP authClient={neon.auth}>
      <QueryClientProvider client={queryClient}>
        <AuthQueryCacheLifecycle>
          <BrowserRouter>
            <AppThemeProvider>
              <App />
              <ToastProvider />
            </AppThemeProvider>
          </BrowserRouter>
        </AuthQueryCacheLifecycle>
      </QueryClientProvider>
    </NeonAuthUIProvider>
  </StrictMode>
);
