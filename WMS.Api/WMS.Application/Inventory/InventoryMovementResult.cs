using WMS.Application.InventoryTransactions;

namespace WMS.Application.Inventory;

public sealed record InventoryMovementResult(
    InventoryTransactionResponse Transaction,
    bool IsReplay);
