namespace WMS.Application.Inventory;

public sealed record CreateInventoryTransferRequest(
    Guid ProductId,
    Guid SourceLocationId,
    Guid DestinationLocationId,
    decimal Quantity,
    Guid? ReferenceId);
