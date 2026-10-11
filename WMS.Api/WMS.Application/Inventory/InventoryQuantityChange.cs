namespace WMS.Application.Inventory;

public sealed record InventoryQuantityChange(
    Guid ProductId,
    Guid LocationId,
    decimal QuantityDelta);
