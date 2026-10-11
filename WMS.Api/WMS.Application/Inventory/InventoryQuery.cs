namespace WMS.Application.Inventory;

public sealed record InventoryQuery(
    Guid? ProductId,
    Guid? LocationId,
    Guid? WarehouseId);
