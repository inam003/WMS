using WMS.Application.InventoryTransactions;

namespace WMS.Application.Inventory;

public enum InventoryMovementPersistenceStatus
{
    Created,
    Replayed,
    IdempotencyConflict,
    QuantityLimitExceeded,
    InsufficientInventory,
    OrderNotReady
}

public sealed record InventoryMovementPersistenceResult(
    InventoryMovementPersistenceStatus Status,
    IReadOnlyList<InventoryTransactionResponse>? Transactions);
