using WMS.Application.InventoryTransactions;

namespace WMS.Application.Inventory;

public enum InventoryMovementPersistenceStatus
{
    Created,
    Replayed,
    IdempotencyConflict,
    QuantityLimitExceeded,
    InsufficientInventory
}

public sealed record InventoryMovementPersistenceResult(
    InventoryMovementPersistenceStatus Status,
    InventoryTransactionResponse? Transaction);
