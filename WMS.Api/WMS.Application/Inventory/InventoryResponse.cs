namespace WMS.Application.Inventory;

public sealed record InventoryResponse(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string SKU,
    Guid LocationId,
    string LocationName,
    string LocationCode,
    Guid WarehouseId,
    string WarehouseName,
    decimal Quantity);
