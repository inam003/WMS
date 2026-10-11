namespace WMS.Application.InventoryTransactions;

public sealed record InventoryTransactionResponse(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string SKU,
    Guid LocationId,
    string LocationName,
    string LocationCode,
    Guid WarehouseId,
    string WarehouseName,
    decimal Quantity,
    string Type,
    Guid? ReferenceId,
    string CreatedBy,
    DateTimeOffset CreatedAt);
