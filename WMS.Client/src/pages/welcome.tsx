import { Box, Button, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function Welcome() {
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
      <Paper
        variant="outlined"
        sx={{ width: '100%', maxWidth: 560, p: { xs: 3, sm: 4 }, textAlign: 'center' }}
      >
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
          WAREHOUSE MANAGEMENT
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mt: 1 }}>
          Welcome to WMS
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Your invitation is ready. Create an account with the email address that received it to get started.
        </Typography>
        <Button component={RouterLink} to="/auth/sign-up" variant="contained">
          Create an account
        </Button>
      </Paper>
    </Box>
  );
}
