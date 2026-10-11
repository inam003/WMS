import { useContext } from 'react';
import type { CurrentWmsUser } from '../lib/api';
import { WmsAccessContext } from '../components/wms-access-context-value';

export function useWmsAccess(): CurrentWmsUser {
  const user = useContext(WmsAccessContext);
  if (!user) {
    throw new Error('WMS access context is not available.');
  }
  return user;
}
