import type { ReactNode } from 'react';
import { Box, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export function DialogTitleWithClose({
  children,
  onClose,
  disabled = false,
}: {
  children: ReactNode;
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <DialogTitle
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box component="span">{children}</Box>
      <IconButton
        size="small"
        onClick={onClose}
        disabled={disabled}
        aria-label="Close dialog"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </DialogTitle>
  );
}
