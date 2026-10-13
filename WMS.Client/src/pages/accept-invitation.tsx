import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ApiError, claimWmsInvitation } from '../lib/api';
import { showToast } from '../lib/toast';

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'This invitation could not be accepted.';
  }

  switch (error.code) {
    case 'INVITATION_EXPIRED':
      return 'This invitation has expired. Ask your WMS Admin to send a new one.';
    case 'INVITATION_REVOKED':
      return 'This invitation was cancelled. Contact your WMS Admin for help.';
    case 'INVITATION_ALREADY_USED':
      return 'This invitation has already been used. Sign up with the invited email address to continue.';
    case 'INVITATION_INVALID':
      return 'This invitation link is invalid. Ask your WMS Admin to send a new one.';
    case 'WMS_ACCOUNT_ALREADY_ACTIVE':
      return 'This account already has active WMS access. Sign in to continue.';
    default:
      return error.message;
  }
}

export function AcceptInvitation() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
  const navigate = useNavigate();
  const [claimError, setClaimError] = useState<string>();
  const error = token
    ? claimError
    : 'This invitation link is missing its token.';

  useEffect(() => {
    const controller = new AbortController();
    if (!token) {
      showToast('This invitation link is missing its token.', 'error');
      return () => controller.abort();
    }

    void claimWmsInvitation(token, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) {
          navigate('/welcome', { replace: true });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          const message = errorMessage(reason);
          setClaimError(message);
          showToast(message, 'error');
        }
      });
    return () => controller.abort();
  }, [navigate, token]);

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        px: 2,
        py: 4,
      }}
    >
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 560, p: { xs: 3, sm: 4 } }}>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
          WAREHOUSE MANAGEMENT
        </Typography>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mt: 1 }}>
          {error ? 'Invitation link unavailable' : 'Preparing your invitation…'}
        </Typography>
        {error ? (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Button component={RouterLink} to="/auth/sign-up" variant="contained">
              Create an account
            </Button>
          </Stack>
        ) : (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
            <CircularProgress aria-label="Accepting invitation" />
          </Box>
        )}
      </Paper>
    </Box>
  );
}
