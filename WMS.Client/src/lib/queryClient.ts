import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          return error.status !== undefined && error.status >= 500 && failureCount < 1;
        }

        return false;
      },
    },
  },
});
