import type { WmsRole } from './api';

export function isMasterDataManager(role: WmsRole): boolean {
  return role === 'Admin' || role === 'WarehouseManager';
}

export function canOperateInventory(role: WmsRole): boolean {
  return role !== 'Viewer';
}
