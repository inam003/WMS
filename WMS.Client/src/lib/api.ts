import { neon } from './neon';

export interface AuthenticatedApiUser {
  subject: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string;
  unit: string;
  minimumStockLevel: number;
  barcode: string | null;
  isActive: boolean;
}

export interface ProductRequest {
  sku: string;
  name: string;
  description: string | null;
  categoryId: string;
  unit: string;
  minimumStockLevel: number;
  barcode: string | null;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface CategoryRequest {
  name: string;
  description: string | null;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

export interface WarehouseRequest {
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

export interface Location {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
}

export interface LocationRequest {
  warehouseId: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
}

export interface InventoryRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  type: string;
  referenceId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface InventoryTransactionFilters {
  productId?: string;
  locationId?: string;
  warehouseId?: string;
  type?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface InventoryFilters {
  productId?: string;
  locationId?: string;
  warehouseId?: string;
}

export interface InventoryReceiptRequest {
  productId: string;
  locationId: string;
  quantity: number;
  referenceId: string | null;
}

interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status?: number;
  readonly validationErrors?: Record<string, string[]>;

  constructor(
    message: string,
    status?: number,
    validationErrors?: Record<string, string[]>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

function isCompactJwt(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.split('.').length === 3 &&
    value.split('.').every((segment) => segment.length > 0)
  );
}

async function getBearerToken(): Promise<string> {
  const tokenResult = await neon.auth.token();
  if (isCompactJwt(tokenResult.data?.token)) {
    return tokenResult.data.token;
  }

  const sessionResult = await neon.auth.getSession();
  const sessionToken = sessionResult.data?.session?.token;
  if (isCompactJwt(sessionToken)) {
    return sessionToken;
  }

  if (!sessionResult.data?.session && sessionResult.error?.status !== undefined) {
    throw new ApiError(
      `Could not check the Neon Auth session (HTTP ${sessionResult.error.status}).`,
    );
  }

  if (!sessionResult.data?.session) {
    throw new ApiError('No active Neon Auth session was found. Sign in and try again.');
  }

  if (tokenResult.error?.status !== undefined) {
    throw new ApiError(
      `Neon Auth could not provide an API token (HTTP ${tokenResult.error.status}).`,
    );
  }

  throw new ApiError(
    'A Neon Auth session exists, but it did not contain a usable API token.',
  );
}

function parseProblemDetails(value: unknown): ProblemDetails {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  const errors: Record<string, string[]> = {};
  if (typeof candidate.errors === 'object' && candidate.errors !== null) {
    for (const [field, messages] of Object.entries(candidate.errors)) {
      if (Array.isArray(messages)) {
        errors[field] = messages.filter(
          (message): message is string => typeof message === 'string',
        );
      }
    }
  }

  return {
    ...(typeof candidate.title === 'string' ? { title: candidate.title } : {}),
    ...(typeof candidate.detail === 'string' ? { detail: candidate.detail } : {}),
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  };
}

export async function authenticatedApiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!apiBaseUrl) {
    throw new ApiError('VITE_API_BASE_URL is not configured.');
  }

  const token = await getBearerToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(
      `${apiBaseUrl.replace(/\/+$/, '')}${path}`,
      { ...init, headers },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      'Could not reach the WMS API. Confirm it is running at VITE_API_BASE_URL and, when using HTTPS locally, trust the ASP.NET development certificate.',
      undefined,
      undefined,
      { cause: error },
    );
  }

  const responseText = await response.text();
  let responseBody: unknown = null;
  let invalidJson = false;
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      invalidJson = true;
    }
  }

  if (!response.ok) {
    const problem = parseProblemDetails(invalidJson ? null : responseBody);
    const validationMessage = problem.errors
      ? Object.values(problem.errors).flat().join(' ')
      : undefined;
    const message =
      validationMessage ??
      problem.detail ??
      problem.title ??
      `The API request failed (HTTP ${response.status}).`;
    throw new ApiError(message, response.status, problem.errors);
  }

  if (!responseText && response.status !== 204) {
    throw new ApiError('The API returned an empty response.', response.status);
  }

  if (invalidJson) {
    throw new ApiError('The API returned an invalid JSON response.', response.status);
  }

  return responseBody as T | null;
}

export async function getAuthenticatedApiUser(): Promise<AuthenticatedApiUser> {
  const user =
    await authenticatedApiRequest<AuthenticatedApiUser>('/api/auth/me');
  if (!user) {
    throw new ApiError('The API returned no authenticated user.');
  }
  return user;
}

export async function getProducts(signal?: AbortSignal): Promise<Product[]> {
  const products = await authenticatedApiRequest<Product[]>('/api/products', {
    signal,
  });
  if (!Array.isArray(products)) {
    throw new ApiError('The API returned an invalid product list.');
  }
  return products;
}

export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const categories =
    await authenticatedApiRequest<Category[]>('/api/categories', { signal });
  if (!Array.isArray(categories)) {
    throw new ApiError('The API returned an invalid category list.');
  }
  return categories;
}

export function getCategory(id: string): Promise<Category | null> {
  return authenticatedApiRequest<Category>(
    `/api/categories/${encodeURIComponent(id)}`,
  );
}

export function createCategory(
  request: CategoryRequest,
): Promise<Category | null> {
  return authenticatedApiRequest<Category>('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function updateCategory(
  id: string,
  request: CategoryRequest,
): Promise<Category | null> {
  return authenticatedApiRequest<Category>(
    `/api/categories/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
}

export async function deleteCategory(id: string): Promise<void> {
  await authenticatedApiRequest<never>(
    `/api/categories/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export async function getWarehouses(signal?: AbortSignal): Promise<Warehouse[]> {
  const warehouses =
    await authenticatedApiRequest<Warehouse[]>('/api/warehouses', { signal });
  if (!Array.isArray(warehouses)) {
    throw new ApiError('The API returned an invalid warehouse list.');
  }
  return warehouses;
}

export function getWarehouse(
  id: string,
  signal?: AbortSignal,
): Promise<Warehouse | null> {
  return authenticatedApiRequest<Warehouse>(
    `/api/warehouses/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function createWarehouse(
  request: WarehouseRequest,
): Promise<Warehouse | null> {
  return authenticatedApiRequest<Warehouse>('/api/warehouses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function updateWarehouse(
  id: string,
  request: WarehouseRequest,
): Promise<Warehouse | null> {
  return authenticatedApiRequest<Warehouse>(
    `/api/warehouses/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
}

export async function deleteWarehouse(id: string): Promise<void> {
  await authenticatedApiRequest<never>(
    `/api/warehouses/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export async function getLocations(signal?: AbortSignal): Promise<Location[]> {
  const locations = await authenticatedApiRequest<Location[]>('/api/locations', {
    signal,
  });
  if (!Array.isArray(locations)) {
    throw new ApiError('The API returned an invalid location list.');
  }
  return locations;
}

export function getLocation(
  id: string,
  signal?: AbortSignal,
): Promise<Location | null> {
  return authenticatedApiRequest<Location>(
    `/api/locations/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function createLocation(
  request: LocationRequest,
): Promise<Location | null> {
  return authenticatedApiRequest<Location>('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function updateLocation(
  id: string,
  request: LocationRequest,
): Promise<Location | null> {
  return authenticatedApiRequest<Location>(
    `/api/locations/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
}

export async function deleteLocation(id: string): Promise<void> {
  await authenticatedApiRequest<never>(
    `/api/locations/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export async function getInventory(
  filters: InventoryFilters = {},
  signal?: AbortSignal,
): Promise<InventoryRecord[]> {
  const query = new URLSearchParams();
  if (filters.productId) query.set('productId', filters.productId);
  if (filters.locationId) query.set('locationId', filters.locationId);
  if (filters.warehouseId) query.set('warehouseId', filters.warehouseId);
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const inventory = await authenticatedApiRequest<InventoryRecord[]>(
    `/api/inventory${suffix}`,
    { signal },
  );
  if (!Array.isArray(inventory)) {
    throw new ApiError('The API returned an invalid inventory list.');
  }
  return inventory;
}

export async function receiveInventory(
  request: InventoryReceiptRequest,
  idempotencyKey: string,
): Promise<InventoryTransaction | null> {
  return authenticatedApiRequest<InventoryTransaction>('/api/inventory/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
  });
}

export function getInventoryRecord(id: string): Promise<InventoryRecord | null> {
  return authenticatedApiRequest<InventoryRecord>(
    `/api/inventory/${encodeURIComponent(id)}`,
  );
}

export async function getInventoryTransactions(
  filters: InventoryTransactionFilters = {},
  signal?: AbortSignal,
): Promise<InventoryTransaction[]> {
  const query = new URLSearchParams();
  if (filters.productId) query.set('productId', filters.productId);
  if (filters.locationId) query.set('locationId', filters.locationId);
  if (filters.warehouseId) query.set('warehouseId', filters.warehouseId);
  if (filters.type) query.set('type', filters.type);
  if (filters.createdFrom) query.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) query.set('createdTo', filters.createdTo);
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const transactions =
    await authenticatedApiRequest<InventoryTransaction[]>(
      `/api/inventory-transactions${suffix}`,
      { signal },
    );
  if (!Array.isArray(transactions)) {
    throw new ApiError('The API returned an invalid inventory transaction list.');
  }
  return transactions;
}

export function getInventoryTransaction(
  id: string,
): Promise<InventoryTransaction | null> {
  return authenticatedApiRequest<InventoryTransaction>(
    `/api/inventory-transactions/${encodeURIComponent(id)}`,
  );
}

export function getProduct(
  id: string,
  signal?: AbortSignal,
): Promise<Product | null> {
  return authenticatedApiRequest<Product>(
    `/api/products/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function createProduct(request: ProductRequest): Promise<Product | null> {
  return authenticatedApiRequest<Product>('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function updateProduct(
  id: string,
  request: ProductRequest,
): Promise<Product | null> {
  return authenticatedApiRequest<Product>(
    `/api/products/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
}

export async function deleteProduct(id: string): Promise<void> {
  await authenticatedApiRequest<never>(
    `/api/products/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
