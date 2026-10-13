import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ToastAlert as Alert } from '../components/ToastProvider';
import { DateFilterField } from '../components/DateFilterField';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  getAuditHistory,
  type AuditHistoryFilters,
  type AuditHistoryItem,
} from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

const pageSize = 25;

function filterTimestamp(date: string, isEnd: boolean): string | undefined {
  if (!date) return undefined;
  return `${date}T${isEnd ? '23:59:59.999' : '00:00:00'}Z`;
}

function prettyJson(value: string | null): string {
  if (!value) return 'Not recorded';
  try {
    return JSON.stringify(JSON.parse(value) as unknown, null, 2);
  } catch {
    return value;
  }
}

function requestError(error: unknown): string {
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 401) return 'Your session has expired. Sign in again to view audit history.';
    if (status === 403) return 'Only WMS administrators can view audit history.';
  }
  return error instanceof Error ? error.message : 'Could not load audit history.';
}

export function AuditHistory() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [user, setUser] = useState('');
  const [actionType, setActionType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditHistoryItem | null>(null);

  const filters = useMemo<AuditHistoryFilters>(
    () => ({
      ...(filterTimestamp(startDate, false)
        ? { startDate: filterTimestamp(startDate, false) }
        : {}),
      ...(filterTimestamp(endDate, true)
        ? { endDate: filterTimestamp(endDate, true) }
        : {}),
      ...(user.trim() ? { user: user.trim() } : {}),
      ...(actionType.trim() ? { actionType: actionType.trim() } : {}),
      ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
      ...(entityId.trim() ? { entityId: entityId.trim() } : {}),
      page: page + 1,
      pageSize,
    }),
    [actionType, endDate, entityId, entityType, page, startDate, user],
  );

  const history = useQuery({
    queryKey: queryKeys.audit.page(filters),
    queryFn: ({ signal }) => getAuditHistory(filters, signal),
  });

  const handleFilterChange = (change: () => void) => {
    change();
    setPage(0);
  };

  return (
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Audit History
          </Typography>
          <Typography color="text.secondary">
            Administrative and inventory-changing activity. Records are retained for 24 hours.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <DateFilterField
              label="From"
              value={startDate}
              onChange={(value) =>
                handleFilterChange(() => setStartDate(value))
              }
            />
            <DateFilterField
              label="To"
              value={endDate}
              onChange={(value) =>
                handleFilterChange(() => setEndDate(value))
              }
            />
            <TextField
              label="User subject"
              size="small"
              value={user}
              onChange={(event) =>
                handleFilterChange(() => setUser(event.target.value))
              }
            />
            <TextField
              label="Action"
              size="small"
              value={actionType}
              onChange={(event) =>
                handleFilterChange(() => setActionType(event.target.value))
              }
            />
            <TextField
              label="Entity type"
              size="small"
              value={entityType}
              onChange={(event) =>
                handleFilterChange(() => setEntityType(event.target.value))
              }
            />
            <TextField
              label="Entity ID or reference"
              size="small"
              value={entityId}
              onChange={(event) =>
                handleFilterChange(() => setEntityId(event.target.value))
              }
            />
          </Box>
        </Paper>

        {history.isError && (
          <Alert severity="error">{requestError(history.error)}</Alert>
        )}
        {history.isPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress aria-label="Loading audit history" />
          </Box>
        ) : (
          <Paper variant="outlined">
            <TableContainer>
              <Table size="small" aria-label="Audit history">
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>User subject</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Entity</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="right">Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(history.data?.items ?? []).map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell>{new Date(record.createdAt).toLocaleString()}</TableCell>
                      <TableCell sx={{ maxWidth: 180, overflowWrap: 'anywhere' }}>
                        {record.actorSubject}
                      </TableCell>
                      <TableCell>{record.actionType}</TableCell>
                      <TableCell>
                        {record.entityType}: {record.entityId}
                      </TableCell>
                      <TableCell>
                        {record.referenceId ?? record.correlationId ?? '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<VisibilityOutlinedIcon />}
                          onClick={() => setSelected(record)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.data?.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                        No audit records match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={history.data?.totalCount ?? 0}
              page={page}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[pageSize]}
            />
          </Paper>
        )}
      </Stack>
      </Box>

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {selected?.actionType} · {selected?.entityType}
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Typography variant="body2">
                <strong>Entity:</strong> {selected.entityId}
                {' · '}
                <strong>By:</strong> {selected.actorSubject}
                {' · '}
                <strong>At:</strong> {new Date(selected.createdAt).toLocaleString()}
              </Typography>
              {(selected.referenceId || selected.correlationId) && (
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  <strong>Reference:</strong>{' '}
                  {selected.referenceId ?? selected.correlationId}
                </Typography>
              )}
              <Box>
                <Typography variant="subtitle2" gutterBottom>Before</Typography>
                <Paper
                  component="pre"
                  variant="outlined"
                  sx={{ p: 1.5, m: 0, overflow: 'auto', whiteSpace: 'pre-wrap' }}
                >
                  {prettyJson(selected.beforeValues)}
                </Paper>
              </Box>
              <Box>
                <Typography variant="subtitle2" gutterBottom>After</Typography>
                <Paper
                  component="pre"
                  variant="outlined"
                  sx={{ p: 1.5, m: 0, overflow: 'auto', whiteSpace: 'pre-wrap' }}
                >
                  {prettyJson(selected.afterValues)}
                </Paper>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
