import type { ReactNode } from 'react';
import type { AlertProps } from '@mui/material/Alert';

export type ToastSeverity = 'error' | 'info' | 'success' | 'warning';

export type ToastEvent = {
  message: string;
  severity: ToastSeverity;
  action?: ReactNode;
  onClose?: AlertProps['onClose'];
};

let lastToastKey = '';
let lastToastAt = 0;
const toastListeners = new Set<(toast: ToastEvent) => void>();
const pendingToasts: ToastEvent[] = [];

export function showToast(
  message: string,
  severity: ToastSeverity = 'info',
  action?: ReactNode,
  onClose?: AlertProps['onClose'],
) {
  if (typeof window === 'undefined' || !message.trim()) return;
  const key = `${severity}:${message}`;
  if (key === lastToastKey && Date.now() - lastToastAt < 1200) return;
  lastToastKey = key;
  lastToastAt = Date.now();
  const toast = { message, severity, action, onClose };
  if (toastListeners.size === 0) pendingToasts.push(toast);
  else toastListeners.forEach((listener) => listener(toast));
}

export function subscribeToToasts(listener: (toast: ToastEvent) => void) {
  toastListeners.add(listener);
  pendingToasts.splice(0).forEach(listener);
  return () => {
    toastListeners.delete(listener);
  };
}
