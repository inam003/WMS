import { useLayoutEffect, useRef, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { neon } from '../lib/neon';

export function AuthQueryCacheLifecycle({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const session = neon.auth.useSession();
  const userId = session.data?.user.id ?? null;
  const previousUserId = useRef<string | null | undefined>(undefined);

  useLayoutEffect(() => {
    if (session.isPending || previousUserId.current === userId) {
      return;
    }

    queryClient.clear();
    previousUserId.current = userId;
  }, [queryClient, session.isPending, userId]);

  return children;
}
