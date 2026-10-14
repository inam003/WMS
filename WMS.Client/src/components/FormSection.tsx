import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

interface FormSectionProps {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
}

export function FormSection({ step, title, description, children }: FormSectionProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '260px 1fr' },
        gap: { xs: 2, md: 4 },
        p: { xs: 2, sm: 3 },
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'grid',
            placeItems: 'center',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {step}
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Stack>
      <Stack spacing={2.5}>{children}</Stack>
    </Box>
  );
}

export function FormFooter({ message, children }: { message?: string; children: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{
        p: { xs: 2, sm: 3 },
        alignItems: { sm: 'center' },
        justifyContent: 'space-between',
        bgcolor: 'action.hover',
      }}
    >
      <Typography color="text.secondary" variant="body2" role="status">
        {message ?? 'All required details are filled in.'}
      </Typography>
      {children}
    </Stack>
  );
}
