import type { PropsWithChildren } from 'react';
import type { CurrentWmsUser } from '../lib/api';
import { WmsAccessContext } from './wms-access-context-value';

export function WmsAccessProvider({
  user,
  children,
}: PropsWithChildren<{ user: CurrentWmsUser }>) {
  return (
    <WmsAccessContext.Provider value={user}>
      {children}
    </WmsAccessContext.Provider>
  );
}
