import { useEffect, useRef, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import type { AlertProps } from '@mui/material/Alert';
import { showToast, subscribeToToasts } from '../lib/toast';
import type { ToastEvent } from '../lib/toast';

type ToastItem = ToastEvent & {
  id: number;
};

export function ToastAlert(props: AlertProps) {
  const { severity = 'info', children, action, onClose } = props;
  const contentRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef('');

  useEffect(() => {
    const message = contentRef.current?.textContent?.replace(/\s+/g, ' ').trim();
    const key = `${severity}:${message ?? ''}`;
    if (message && key !== lastMessageRef.current) {
      lastMessageRef.current = key;
      showToast(message, severity, action, onClose);
    } else if (!message) {
      lastMessageRef.current = '';
    }
  }, [action, children, onClose, severity]);

  return (
    <div ref={contentRef} hidden aria-hidden="true">
      {children}
    </div>
  );
}

export function ToastProvider() {
  const [queue, setQueue] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = Date.now();
    const handleToast = (toast: ToastEvent) => {
      setQueue((current) => [
        ...current,
        { ...toast, id: ++nextId },
      ]);
    };
    return subscribeToToasts(handleToast);
  }, []);

  const dismiss = () => setQueue((current) => current.slice(1));
  const activeToast = queue[0];

  return (
    <Snackbar
      key={activeToast?.id ?? 'empty'}
      open={Boolean(activeToast)}
      autoHideDuration={5000}
      onClose={dismiss}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      {activeToast ? (
        <Alert
          severity={activeToast.severity}
          action={activeToast.action}
          variant="filled"
          sx={{ width: '100%', maxWidth: 480 }}
        >
          {activeToast.message}
        </Alert>
      ) : (
        <span />
      )}
    </Snackbar>
  );
}
