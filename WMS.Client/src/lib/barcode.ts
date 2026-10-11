export function generateInternalBarcode(kind: 'product' | 'location'): string {
  const prefix = kind === 'product' ? 'WMS-P' : 'WMS-L';
  return `${prefix}-${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
}
