using WMS.Application.InventoryTransactions;

namespace WMS.Application.Inventory;

public enum ReceiptPersistenceStatus
{
    Created,
    Replayed,
    IdempotencyConflict,
    QuantityLimitExceeded
}

public sealed record ReceiptPersistenceResult(
    ReceiptPersistenceStatus Status,
    InventoryTransactionResponse? Transaction);
