import { createContext } from 'react';
import type { CurrentWmsUser } from '../lib/api';

export const WmsAccessContext = createContext<CurrentWmsUser | null>(null);
