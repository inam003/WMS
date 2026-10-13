import { neon } from './neon';

export interface AuthenticatedApiUser {
  subject: string;
}

export type WmsRole =
  | 'Admin'
  | 'WarehouseManager'
  | 'WarehouseOperator'
  | 'Viewer';

export interface WmsUser {
  subject: string;
  role: WmsRole;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accessProvisionedAt: string | null;
}

export interface CurrentWmsUser {
  subject: string;
  role: WmsRole;
  isActive: boolean;
}

export interface WmsInvitation {
  id: string;
  email: string;
  role: WmsRole;
  status: 'Pending' | 'Accepted' | 'Expired' | 'Revoked';
  inviterSubject: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedSubject: string | null;
}

export interface ValidatedWmsInvitation {
  email: string;
  role: WmsRole;
  expiresAt: string;
}

export interface AuditHistoryItem {
  id: string;
  actorSubject: string;
  actionType: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  referenceId: string | null;
  correlationId: string | null;
  beforeValues: string | null;
  afterValues: string | null;
}

export interface AuditHistoryPage {
  items: AuditHistoryItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface AuditHistoryFilters {
  startDate?: string;
  endDate?: string;
  user?: string;
  actionType?: string;
  entityType?: string;
  entityId?: string;
  page?: number;
  pageSize?: number;
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
  barcode: string | null;
}

export interface LocationRequest {
  warehouseId: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
  barcode: string | null;
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
  adjustmentReason: string | null;
  adjustmentExplanation: string | null;
  transferId: string | null;
  orderId: string | null;
  orderLineId: string | null;
}

export type CustomerOrderStatus =
  | 'Draft'
  | 'Ready'
  | 'Dispatched'
  | 'Cancelled'
  | 0
  | 1
  | 2
  | 3;

export interface OrderLineRequest {
  productId: string;
  quantity: number;
}

export interface OrderRequest {
  customerName: string | null;
  referenceId: string | null;
  lines: OrderLineRequest[];
}

export interface OrderLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  dispatchLocationId: string | null;
  dispatchLocationName: string | null;
  dispatchWarehouseName: string | null;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  customerName: string | null;
  referenceId: string | null;
  status: CustomerOrderStatus;
  createdBy: string;
  createdAt: string;
  dispatchedBy: string | null;
  dispatchedAt: string | null;
  lines: OrderLine[];
}

export interface OrderDispatchRequest {
  lines: { orderLineId: string; locationId: string }[];
}

export interface InventoryTransactionFilters {
  productId?: string;
  locationId?: string;
  warehouseId?: string;
  type?: string;
  createdFrom?: string;
  createdTo?: string;
}

export type ReportKind =
  | 'stock'
  | 'movements'
  | 'receiving'
  | 'adjustments'
  | 'transfers'
  | 'orders';

export interface ReportFilters {
  productId?: string;
  warehouseId?: string;
  locationId?: string;
  keyword?: string;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface ReportPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface StockReportRow {
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  quantity: number;
}

export interface MovementReportRow {
  transactionId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  type: string;
  quantity: number;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  referenceId: string | null;
  createdBy: string;
  createdAt: string;
  adjustmentReason: string | number | null;
  adjustmentExplanation: string | null;
  transferId: string | null;
  orderId: string | null;
}

export interface TransferReportRow {
  transferId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  sourceLocationId: string;
  sourceLocationName: string;
  sourceLocationCode: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  destinationLocationCode: string;
  referenceId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface OrderReportRow {
  orderId: string;
  orderNumber: string;
  status: string | number;
  customerName: string | null;
  referenceId: string | null;
  productId: string;
  productName: string;
  sku: string;
  requestedQuantity: number;
  dispatchedQuantity: number;
  dispatchLocationId: string | null;
  dispatchLocationName: string | null;
  dispatchLocationCode: string | null;
  dispatchWarehouseId: string | null;
  dispatchWarehouseName: string | null;
  createdBy: string;
  createdAt: string;
  dispatchedBy: string | null;
  dispatchedAt: string | null;
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

export type InventoryAdjustmentType = 'Increase' | 'Decrease';
export type InventoryAdjustmentReason =
  | 'DamagedStock'
  | 'LostOrMissingStock'
  | 'PhysicalCountCorrection'
  | 'Other';

export interface InventoryAdjustmentRequest {
  productId: string;
  locationId: string;
  type: InventoryAdjustmentType;
  quantity: number;
  reason: InventoryAdjustmentReason;
  explanation: string | null;
}

export interface InventoryTransferRequest {
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  referenceId: string | null;
}

interface ProblemDetails {
  title?: string;
  detail?: string;
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly validationErrors?: Record<string, string[]>;

  constructor(
    message: string,
    status?: number,
    validationErrors?: Record<string, string[]>,
    options?: ErrorOptions,
    code?: string,
  ) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
      `Could not check your sign-in session (HTTP ${sessionResult.error.status}).`,
    );
  }

  if (!sessionResult.data?.session) {
    throw new ApiError('No active sign-in session was found. Sign in and try again.');
  }

  if (tokenResult.error?.status !== undefined) {
    throw new ApiError(
      `Your sign-in provider could not provide an access token (HTTP ${tokenResult.error.status}).`,
    );
  }

  throw new ApiError(
    'Your sign-in session did not contain a usable access token.',
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
    ...(typeof candidate.message === 'string' ? { message: candidate.message } : {}),
    ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  };
}

function getApiBaseUrl(): string {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!apiBaseUrl) {
    throw new ApiError('VITE_API_BASE_URL is not configured.');
  }
  return apiBaseUrl.replace(/\/+$/, '');
}

async function readApiResponse<T>(response: Response): Promise<T | null> {
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
      problem.message ??
      problem.detail ??
      problem.title ??
      (response.status === 401
        ? 'Your sign-in is no longer valid. Sign in again to continue.'
        : response.status === 403
          ? 'Your WMS account does not have permission for this action.'
          : undefined) ??
      `The API request failed (HTTP ${response.status}).`;
    throw new ApiError(
      message,
      response.status,
      problem.errors,
      undefined,
      problem.code,
    );
  }

  if (!responseText && response.status !== 204) {
    throw new ApiError('The API returned an empty response.', response.status);
  }

  if (invalidJson) {
    throw new ApiError('The API returned an invalid JSON response.', response.status);
  }

  return responseBody as T | null;
}

export async function authenticatedApiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const token = await getBearerToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(
      `${getApiBaseUrl()}${path}`,
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

  return readApiResponse<T>(response);
}

export async function publicApiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError('Could not reach the WMS API.', undefined, undefined, {
      cause: error,
    });
  }

  return readApiResponse<T>(response);
}

export async function getAuthenticatedApiUser(): Promise<AuthenticatedApiUser> {
  const user =
    await authenticatedApiRequest<AuthenticatedApiUser>('/api/auth/me');
  if (!user) {
    throw new ApiError('The API returned no authenticated user.');
  }

  return user;
}

export async function getCurrentWmsUser(): Promise<CurrentWmsUser> {
  const user = await authenticatedApiRequest<CurrentWmsUser>('/api/users/me');
  if (!user) throw new ApiError('The API returned no WMS access record.');
  return user;
}

export async function getAuditHistory(
  filters: AuditHistoryFilters = {},
  signal?: AbortSignal,
): Promise<AuditHistoryPage> {
  const query = new URLSearchParams();
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  if (filters.user) query.set('user', filters.user);
  if (filters.actionType) query.set('actionType', filters.actionType);
  if (filters.entityType) query.set('entityType', filters.entityType);
  if (filters.entityId) query.set('entityId', filters.entityId);
  query.set('page', String(filters.page ?? 1));
  query.set('pageSize', String(filters.pageSize ?? 25));
  const result = await authenticatedApiRequest<AuditHistoryPage>(
    `/api/audit?${query.toString()}`,
    { signal },
  );
  if (!result || !Array.isArray(result.items)) {
    throw new ApiError('The API returned invalid audit history.');
  }
  return result;
}

export async function getWmsUsers(signal?: AbortSignal): Promise<WmsUser[]> {
  const users = await authenticatedApiRequest<WmsUser[]>('/api/users', { signal });
  if (!Array.isArray(users)) throw new ApiError('The API returned an invalid WMS user list.');
  return users;
}

export async function getWmsInvitations(signal?: AbortSignal): Promise<WmsInvitation[]> {
  const invitations = await authenticatedApiRequest<WmsInvitation[]>(
    '/api/users/invitations',
    { signal },
  );
  if (!Array.isArray(invitations)) {
    throw new ApiError('The API returned an invalid invitation list.');
  }
  return invitations;
}

export async function createWmsInvitation(
  email: string,
  role: WmsRole,
): Promise<WmsInvitation> {
  const invitation = await authenticatedApiRequest<WmsInvitation>(
    '/api/users/invitations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    },
  );
  if (!invitation) throw new ApiError('The API returned no invitation.');
  return invitation;
}

export async function resendWmsInvitation(id: string): Promise<WmsInvitation> {
  const invitation = await authenticatedApiRequest<WmsInvitation>(
    `/api/users/invitations/${encodeURIComponent(id)}/resend`,
    { method: 'POST' },
  );
  if (!invitation) throw new ApiError('The API returned no updated invitation.');
  return invitation;
}

export async function revokeWmsInvitation(id: string): Promise<WmsInvitation> {
  const invitation = await authenticatedApiRequest<WmsInvitation>(
    `/api/users/invitations/${encodeURIComponent(id)}/revoke`,
    { method: 'POST' },
  );
  if (!invitation) throw new ApiError('The API returned no updated invitation.');
  return invitation;
}

export async function validateWmsInvitation(
  token: string,
  signal?: AbortSignal,
): Promise<ValidatedWmsInvitation> {
  const invitation = await publicApiRequest<ValidatedWmsInvitation>(
    '/api/invitations/validate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal,
    },
  );
  if (!invitation) throw new ApiError('The API returned no invitation details.');
  return invitation;
}

export async function claimWmsInvitation(
  token: string,
  signal?: AbortSignal,
): Promise<ValidatedWmsInvitation> {
  const invitation = await publicApiRequest<ValidatedWmsInvitation>(
    '/api/invitations/claim',
    {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    signal,
    },
  );
  if (!invitation) throw new ApiError('The API returned no invitation details.');
  return invitation;
}

export async function updateWmsUserRole(
  subject: string,
  role: WmsRole,
): Promise<WmsUser> {
  const user = await authenticatedApiRequest<WmsUser>(
    `/api/users/${encodeURIComponent(subject)}/role`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    },
  );
  if (!user) throw new ApiError('The API returned no updated WMS user.');
  return user;
}

export async function updateWmsUserAccess(
  subject: string,
  isActive: boolean,
): Promise<WmsUser> {
  const user = await authenticatedApiRequest<WmsUser>(
    `/api/users/${encodeURIComponent(subject)}/access`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    },
  );
  if (!user) throw new ApiError('The API returned no updated WMS user.');
  return user;
}

export async function removeWmsUser(subject: string): Promise<void> {
  await authenticatedApiRequest<null>(
    `/api/users/${encodeURIComponent(subject)}`,
    { method: 'DELETE' },
  );
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

export async function getProductByBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<Product | null> {
  try {
    return await authenticatedApiRequest<Product>(
      `/api/products/barcode/${encodeURIComponent(barcode)}`,
      { signal },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
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

export async function getLocationByBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<Location | null> {
  try {
    return await authenticatedApiRequest<Location>(
      `/api/locations/barcode/${encodeURIComponent(barcode)}`,
      { signal },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
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

export async function adjustInventory(
  request: InventoryAdjustmentRequest,
  idempotencyKey: string,
): Promise<InventoryTransaction | null> {
  return authenticatedApiRequest<InventoryTransaction>('/api/inventory/adjustments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
  });
}

export async function transferInventory(
  request: InventoryTransferRequest,
  idempotencyKey: string,
): Promise<InventoryTransaction[] | null> {
  return authenticatedApiRequest<InventoryTransaction[]>('/api/inventory/transfers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
  });
}

export async function getOrders(signal?: AbortSignal): Promise<CustomerOrder[]> {
  const orders = await authenticatedApiRequest<CustomerOrder[]>('/api/orders', {
    signal,
  });
  if (!Array.isArray(orders)) {
    throw new ApiError('The API returned an invalid order list.');
  }
  return orders;
}

export function createOrder(request: OrderRequest): Promise<CustomerOrder | null> {
  return authenticatedApiRequest<CustomerOrder>('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function updateOrder(
  id: string,
  request: OrderRequest,
): Promise<CustomerOrder | null> {
  return authenticatedApiRequest<CustomerOrder>(
    `/api/orders/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
}

export function markOrderReady(id: string): Promise<CustomerOrder | null> {
  return authenticatedApiRequest<CustomerOrder>(
    `/api/orders/${encodeURIComponent(id)}/ready`,
    { method: 'POST' },
  );
}

export function cancelOrder(id: string): Promise<CustomerOrder | null> {
  return authenticatedApiRequest<CustomerOrder>(
    `/api/orders/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
}

export async function dispatchOrder(
  id: string,
  request: OrderDispatchRequest,
  idempotencyKey: string,
): Promise<InventoryTransaction[]> {
  const transactions = await authenticatedApiRequest<InventoryTransaction[]>(
    `/api/orders/${encodeURIComponent(id)}/dispatch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(request),
    },
  );
  if (!Array.isArray(transactions)) {
    throw new ApiError('The API returned invalid dispatch transaction history.');
  }
  return transactions;
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

export async function getReportPage<T>(
  kind: ReportKind,
  filters: ReportFilters = {},
  signal?: AbortSignal,
): Promise<ReportPage<T>> {
  const query = new URLSearchParams();
  if (filters.productId) query.set('productId', filters.productId);
  if (filters.warehouseId) query.set('warehouseId', filters.warehouseId);
  if (filters.locationId) query.set('locationId', filters.locationId);
  if (filters.keyword) query.set('keyword', filters.keyword);
  if (filters.transactionType) query.set('transactionType', filters.transactionType);
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  query.set('page', String(filters.page ?? 1));
  query.set('pageSize', String(filters.pageSize ?? 50));
  const report = await authenticatedApiRequest<ReportPage<T>>(
    `/api/reports/${kind}?${query.toString()}`,
    { signal },
  );
  if (!report || !Array.isArray(report.items)) {
    throw new ApiError('The API returned an invalid report page.');
  }
  return report;
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
