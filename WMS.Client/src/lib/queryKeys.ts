export const queryKeys = {
  categories: {
    all: ['categories'] as const,
    detail: (id: string) => ['categories', 'detail', id] as const,
  },
  products: {
    all: ['products'] as const,
    list: ['products', 'list'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    list: (filters: InventoryQueryFilters) =>
      ['inventory', 'list', filters] as const,
  },
  inventoryTransactions: {
    all: ['inventory-transactions'] as const,
    list: (filters: TransactionQueryFilters) =>
      ['inventory-transactions', 'list', filters] as const,
  },
  warehouses: {
    all: ['warehouses'] as const,
    detail: (id: string) => ['warehouses', 'detail', id] as const,
  },
  locations: {
    all: ['locations'] as const,
    detail: (id: string) => ['locations', 'detail', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  reports: {
    page: (kind: string, filters: object) => ['reports', kind, filters] as const,
  },
  wmsUsers: {
    current: ['wms-user', 'current'] as const,
    all: ['wms-users'] as const,
    invitations: ['wms-user-invitations'] as const,
  },
  audit: {
    page: (filters: object) => ['audit', 'page', filters] as const,
  },
};

interface InventoryQueryFilters {
  productId?: string;
  locationId?: string;
  warehouseId?: string;
}

interface TransactionQueryFilters extends InventoryQueryFilters {
  type?: string;
  createdFrom?: string;
  createdTo?: string;
}
