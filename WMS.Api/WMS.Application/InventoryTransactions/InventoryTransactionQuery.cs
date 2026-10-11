namespace WMS.Application.InventoryTransactions;

public sealed record InventoryTransactionQuery(
    Guid? ProductId,
    Guid? LocationId,
    Guid? WarehouseId,
    string? Type,
    DateTimeOffset? CreatedFrom,
    DateTimeOffset? CreatedTo);
