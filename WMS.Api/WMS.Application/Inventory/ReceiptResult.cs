using WMS.Application.InventoryTransactions;

namespace WMS.Application.Inventory;

public sealed record ReceiptResult(
    InventoryTransactionResponse Transaction,
    bool IsReplay);
