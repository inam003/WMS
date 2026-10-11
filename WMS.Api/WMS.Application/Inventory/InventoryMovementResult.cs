using WMS.Application.InventoryTransactions;

namespace WMS.Application.Inventory;

public sealed record InventoryMovementResult(
    IReadOnlyList<InventoryTransactionResponse> Transactions,
    bool IsReplay)
{
    public InventoryTransactionResponse Transaction => Transactions[0];
}
